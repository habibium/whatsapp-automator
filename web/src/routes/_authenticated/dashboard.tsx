import * as stylex from '@stylexjs/stylex'
import { useQueryClient } from '@tanstack/react-query'
import {
  createFileRoute,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Divider } from '@astryxdesign/core/Divider'
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList'
import { Heading, Text } from '@astryxdesign/core/Text'
import { Timestamp } from '@astryxdesign/core/Timestamp'
import { VStack } from '@astryxdesign/core/VStack'

import { api } from '@/api/client'
import { SiteFrame } from '@/components/site-frame'
import { SIGNIN_HREF, setSessionUser } from '@/lib/session'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: Dashboard,
})

const COLUMN_WIDTH = 560

const styles = stylex.create({
  // `ch` resolves against the element's own font size, so it sits on the text itself.
  measure: { maxWidth: '45ch' },
})

function Dashboard() {
  const { user } = Route.useRouteContext()
  const notice = useLocation({ select: (location) => location.state.notice })
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const signOut = async () => {
    try {
      await api.POST('/api/auth/signout')
    } finally {
      setSessionUser(queryClient, null)
      await navigate({ href: SIGNIN_HREF })
    }
  }

  return (
    <SiteFrame
      action={<Button label="Sign out" variant="ghost" clickAction={signOut} />}
    >
      <VStack gap={8} maxWidth={COLUMN_WIDTH} paddingBlock={10}>
        {notice === 'email-verified' ? (
          <Banner
            status="success"
            title="Your email is verified."
            description="You're signed in, and the account is ready."
            isDismissable
          />
        ) : null}

        <VStack gap={3}>
          <Heading level={1} type="display-3" textWrap="balance">
            Link WhatsApp to get started.
          </Heading>
          <Text color="secondary" size="lg" xstyle={styles.measure}>
            You will scan a QR code with the phone that runs WhatsApp, the same
            way WhatsApp Web connects. Linking is the next part to ship, and it
            will appear on this page.
          </Text>
        </VStack>

        <Divider />

        <MetadataList
          title={<Heading level={2}>Your account</Heading>}
          label={{ position: 'start', width: 160 }}
        >
          <MetadataListItem label="Email">
            <Text>{user.email}</Text>
          </MetadataListItem>
          <MetadataListItem label="Verified">
            {user.verified_at ? (
              <Timestamp
                value={user.verified_at}
                format="date_long"
                type="body"
                color="primary"
              />
            ) : (
              <Text color="secondary">Not yet</Text>
            )}
          </MetadataListItem>
          <MetadataListItem label="Member since">
            <Timestamp
              value={user.created_at}
              format="date_long"
              type="body"
              color="primary"
            />
          </MetadataListItem>
        </MetadataList>
      </VStack>
    </SiteFrame>
  )
}
