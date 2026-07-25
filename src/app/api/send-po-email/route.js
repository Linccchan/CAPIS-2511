import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function POST(req) {
  try {
    const { purchaseOrderId } = await req.json()

    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        suppliers (
          supplier_name,
          email
        )
      `)
      .eq('id', purchaseOrderId)
      .single()

    if (poError) throw poError

    const { data: items, error: itemError } = await supabase
      .from('customer_order_items')
      .select(`
        quantity_ordered,
        products (
          product_name,
          unit
        )
      `)
    .eq('order_id', po.order_id)

if (itemError) throw itemError

    if (itemError) throw itemError

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })

    const formatDate = (date) => {
      if (!date) return 'N/A'
      return new Date(date).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    }

    const rows =
      items.length > 0
        ? items
            .map(
              (item) => `
<tr>
  <td style="border:1px solid #ddd;padding:10px;">
    ${item.products?.product_name ?? 'Unknown Product'}
  </td>
  <td style="border:1px solid #ddd;padding:10px;text-align:center;">
    ${item.quantity_ordered}
  </td>
  <td style="border:1px solid #ddd;padding:10px;text-align:center;">
    ${item.products?.unit ?? '-'}
  </td>
</tr>
`
            )
            .join('')
        : `
<tr>
  <td colspan="3" style="border:1px solid #ddd;padding:12px;text-align:center;">
    No products found for this Purchase Order.
  </td>
</tr>
`

    await transporter.sendMail({
      from: `"DMC Enterprise" <${process.env.GMAIL_USER}>`,
      to: po.suppliers.email,
      subject: `Purchase Order ${po.po_number}`,
      html: `
<div style="font-family:Arial,Helvetica,sans-serif;background:#f5f5f5;padding:30px;">

<div style="max-width:750px;margin:auto;background:white;border-radius:8px;padding:35px;">

<h2 style="margin-top:0;color:#222;">
Purchase Order
</h2>

<p>Dear <strong>${po.suppliers.supplier_name}</strong>,</p>

<p>
DMC Enterprise has created a new Purchase Order for your company.
Please prepare the items listed below and deliver them on or before the expected delivery date.
</p>

<table style="width:100%;margin:25px 0;border-collapse:collapse;">
<tr>
<td style="padding:8px;"><strong>Purchase Order No.</strong></td>
<td>${po.po_number}</td>
</tr>

<tr>
<td style="padding:8px;"><strong>Issued Date</strong></td>
<td>${formatDate(po.issued_date || po.created_at)}</td>
</tr>

<tr>
<td style="padding:8px;"><strong>Expected Delivery</strong></td>
<td>${formatDate(po.expected_delivery_date)}</td>
</tr>

<tr>
<td style="padding:8px;"><strong>Status</strong></td>
<td>${po.status}</td>
</tr>
</table>

<h3>Products Requested</h3>

<table style="width:100%;border-collapse:collapse;">
<thead>
<tr style="background:#222;color:white;">
<th style="padding:10px;border:1px solid #ddd;">Product</th>
<th style="padding:10px;border:1px solid #ddd;">Quantity</th>
<th style="padding:10px;border:1px solid #ddd;">Unit</th>
</tr>
</thead>

<tbody>
${rows}
</tbody>

</table>

<p style="margin-top:30px;">
Please ensure that the products are delivered to the DMC Enterprise warehouse together with the corresponding delivery receipt.
</p>

<p>
If you anticipate any delays or are unable to fulfill the order completely,
please reply to this email so we can coordinate accordingly.
</p>

<hr style="margin:35px 0;">

<p>
Thank you for your continued partnership.
</p>

<p>
<strong>DMC Enterprise</strong><br>
Procurement Department
</p>

</div>

</div>
`,
    })

    return NextResponse.json({
      success: true,
      message: 'Purchase Order email sent successfully.',
    })
  } catch (err) {
    console.error(err)

    return NextResponse.json(
      {
        success: false,
        error: err.message,
      },
      { status: 500 }
    )
  }
}



