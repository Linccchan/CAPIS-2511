import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function POST(req) {
  try {
    const body = await req.json()

    const {
      company_name,
      contact_person,
      email,
      phone,
      country,
      address,
    } = body

    // Invite the user
    const { data, error } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo:
            `${process.env.NEXT_PUBLIC_SITE_URL}/set-password`,
        }
      )

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    const userId = data.user.id

    // Wait for the trigger to create the profile
    let profile = null

    for (let i = 0; i < 10; i++) {
      const { data: p } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (p) {
        profile = p
        break
      }

      await sleep(500)
    }

    if (!profile) {
      return NextResponse.json(
        {
          error: 'Profile was not created.',
        },
        { status: 500 }
      )
    }

    // Update the profile with customer information
    await supabaseAdmin
      .from('profiles')
      .update({
        full_name: contact_person || company_name,
        role: 'customer',
        company_name,
        phone_number: phone,
      })
      .eq('id', userId)

    // Create customer record
    const { data: customer, error: customerError } =
      await supabaseAdmin
        .from('customers')
        .insert({
          profile_id: userId,
          company_name,
          contact_person,
          email,
          phone,
          country,
          address,
        })
        .select()
        .single()

    if (customerError) {
      return NextResponse.json(
        { error: customerError.message },
        { status: 400 }
      )
    }

    return NextResponse.json(customer)

  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    )
  }
}