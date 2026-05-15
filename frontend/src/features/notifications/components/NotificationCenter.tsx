import NotificationBell, { NotificationToastHost } from './NotificationBell'
import { useNotificationCenter } from '../hooks/useNotificationCenter'

export default function NotificationCenter() {
  const {
    items,
    unreadCount,
    open,
    setOpen,
    openTicket,
    markAllRead,
    toasts,
    dismissToast,
    onToastClick,
  } = useNotificationCenter()

  return (
    <>
      <NotificationBell
        items={items}
        unreadCount={unreadCount}
        open={open}
        setOpen={setOpen}
        onOpenTicket={openTicket}
        onMarkAllRead={markAllRead}
      />
      <NotificationToastHost toasts={toasts} onDismiss={dismissToast} onClickToast={onToastClick} />
    </>
  )
}
