import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

export async function POST(request) {
  try {
    const { supplierEmail, supplierName, poNumber } = await request.json()

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: supplierEmail,
      subject: `New Purchase Order ${poNumber}`,
      html: `
        <h2>New Purchase Order</h2>

        <p>Hello ${supplierName},</p>

        <p>A new purchase order has been issued.</p>

        <p><strong>Purchase Order:</strong> ${poNumber}</p>

        <p>Thank you.</p>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}