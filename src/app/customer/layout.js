import CustomerChatbot from '@/components/customer/CustomerChatbot'

export default function CustomerLayout({ children }) {
  return (
    <>
      {children}
      <CustomerChatbot />
    </>
  )
}
