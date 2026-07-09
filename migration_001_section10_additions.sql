-- migration_001_section10_additions.sql
-- Apply ON TOP of the existing schema from sql.docx
-- Run once in Supabase SQL Editor BEFORE Sprint 1 development

-- ============================================================
-- 1. ENUM ADDITIONS
-- ============================================================

-- customer_orders.status
ALTER TYPE public.customer_order_status ADD VALUE IF NOT EXISTS 'pending_quotation' BEFORE 'awaiting_down_payment';
ALTER TYPE public.customer_order_status ADD VALUE IF NOT EXISTS 'pfi_sent'         BEFORE 'awaiting_down_payment';

-- supplier_deliveries.delivery_status
ALTER TYPE public.delivery_status_enum ADD VALUE IF NOT EXISTS 'pending_confirmation' BEFORE 'received';

-- ============================================================
-- 2. NEW TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.quotations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES public.customer_orders(id) ON DELETE CASCADE,
  quotation_number TEXT NOT NULL UNIQUE,
  status           TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','approved','expired','rejected')),
  prepared_by      UUID REFERENCES public.profiles(id),
  sent_at          TIMESTAMPTZ,
  approved_at      TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quotation_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id        UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES public.products(id),
  quantity_requested  INTEGER NOT NULL DEFAULT 0,
  unit_price          NUMERIC(12,4),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES public.customer_orders(id) ON DELETE CASCADE,
  from_status  TEXT,
  to_status    TEXT NOT NULL,
  changed_by   UUID REFERENCES public.profiles(id),
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_prices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  selling_price  NUMERIC(12,4) NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'USD',
  effective_from DATE NOT NULL,
  effective_to   DATE,
  set_by         UUID REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supplier_product_costs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id         UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  unit_cost           NUMERIC(12,4) NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'PHP',
  effective_from      DATE NOT NULL,
  effective_to        DATE,
  source              TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('po_derived','manual')),
  purchase_order_id   UUID REFERENCES public.purchase_orders(id),
  updated_by          UUID REFERENCES public.profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sticker_designs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES public.customer_orders(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES public.products(id),
  destination_country TEXT,
  file_path           TEXT,
  status              TEXT NOT NULL DEFAULT 'photo_sent'
    CHECK (status IN ('photo_sent','awaiting_customer','design_received','printed')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id   UUID REFERENCES public.customer_orders(id),
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. COLUMN ADDITIONS
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_available     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS unit_cbm         NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS unit_weight_kg   NUMERIC(10,4);

ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12,4);

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS version         INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS supersedes_id   UUID REFERENCES public.documents(id);

-- updated_at on major tables
ALTER TABLE public.customer_orders     ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.purchase_orders     ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.labeling_tasks      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.staging_tasks       ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.billings            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.payments            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.shipments           ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- prediction_records: add if table exists from base schema, else create
CREATE TABLE IF NOT EXISTS public.prediction_records (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             UUID NOT NULL REFERENCES public.customer_orders(id) ON DELETE CASCADE,
  predicted_ready_date DATE,
  confidence_score     NUMERIC(5,4),
  model_version        TEXT,
  input_summary        JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(order_id)
);

-- ============================================================
-- 4. TRIGGERS
-- ============================================================

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply updated_at trigger to all major tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'customer_orders','purchase_orders','labeling_tasks','staging_tasks',
    'billings','payments','shipments','sticker_designs'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_updated_at ON public.%I;
       CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- Order status history trigger
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.order_status_history(order_id, from_status, to_status, changed_at)
    VALUES (NEW.id, OLD.status::TEXT, NEW.status::TEXT, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_order_status ON public.customer_orders;
CREATE TRIGGER trg_log_order_status
AFTER UPDATE ON public.customer_orders
FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();

-- Auto-create profile on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_new_user ON auth.users;
CREATE TRIGGER trg_handle_new_user
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-create labeling_task when sticker_design.status = 'printed'
CREATE OR REPLACE FUNCTION public.create_labeling_task_on_print()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'printed' THEN
    INSERT INTO public.labeling_tasks (
      order_id, product_id, required_quantity, completed_quantity, status
    )
    SELECT
      NEW.order_id,
      NEW.product_id,
      COALESCE(oi.quantity_ordered, 0),
      0,
      'pending'
    FROM public.customer_order_items oi
    WHERE oi.order_id = NEW.order_id AND oi.product_id = NEW.product_id
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_labeling_on_print ON public.sticker_designs;
CREATE TRIGGER trg_create_labeling_on_print
AFTER UPDATE ON public.sticker_designs
FOR EACH ROW EXECUTE FUNCTION public.create_labeling_task_on_print();

-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.quotations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_prices        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_product_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sticker_designs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_records    ENABLE ROW LEVEL SECURITY;

-- Notifications: users see only their own
CREATE POLICY IF NOT EXISTS "Own notifications" ON public.notifications
  FOR ALL USING (user_id = auth.uid());

-- Admin/management full access helper
CREATE OR REPLACE FUNCTION public.is_admin_or_mgmt()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role IN ('admin','management') FROM public.profiles WHERE id = auth.uid();
$$;

-- Quotations: admin/management full, customers see their own order quotations
CREATE POLICY IF NOT EXISTS "Admin full quotations" ON public.quotations
  FOR ALL USING (public.is_admin_or_mgmt());

CREATE POLICY IF NOT EXISTS "Customer own quotations" ON public.quotations
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM public.customer_orders
      WHERE customer_id IN (SELECT id FROM public.customers WHERE profile_id = auth.uid())
    )
  );

-- Product prices: admin/management manage, all authenticated read
CREATE POLICY IF NOT EXISTS "Admin manage prices" ON public.product_prices
  FOR ALL USING (public.is_admin_or_mgmt());

CREATE POLICY IF NOT EXISTS "Authenticated read prices" ON public.product_prices
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Supplier costs: admin/management only
CREATE POLICY IF NOT EXISTS "Admin manage supplier costs" ON public.supplier_product_costs
  FOR ALL USING (public.is_admin_or_mgmt());

-- Order status history: admin/management full, customers read own
CREATE POLICY IF NOT EXISTS "Admin view history" ON public.order_status_history
  FOR SELECT USING (public.is_admin_or_mgmt());

-- Sticker designs: admin/management + warehouse
CREATE POLICY IF NOT EXISTS "Admin stickers" ON public.sticker_designs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','management','warehouse'))
  );

-- Prediction records: management + admin read
CREATE POLICY IF NOT EXISTS "Prediction read" ON public.prediction_records
  FOR SELECT USING (public.is_admin_or_mgmt());

-- ============================================================
-- 6. REALTIME SUBSCRIPTIONS
-- Enable in Supabase Dashboard > Database > Replication
-- Tables to enable: customer_orders, purchase_orders,
-- supplier_deliveries, labeling_tasks, staging_tasks, notifications
-- ============================================================

-- ============================================================
-- DONE — verify by running:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1;
-- ============================================================
