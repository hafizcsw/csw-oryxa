import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "CSW World"

interface NewMessageNotificationProps {
  senderName?: string
  messagePreview?: string
  chatUrl?: string
}

const NewMessageNotificationEmail = ({ senderName, messagePreview, chatUrl }: NewMessageNotificationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{senderName ? `New message from ${senderName}` : 'You have a new message'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {senderName ? `New message from ${senderName}` : 'You have a new message'}
        </Heading>
        {messagePreview && (
          <Section style={previewBox}>
            <Text style={previewText}>"{messagePreview}"</Text>
          </Section>
        )}
        <Text style={text}>
          You have received a new direct message on {SITE_NAME}. Log in to view and reply.
        </Text>
        {chatUrl && (
          <Section style={{ textAlign: 'center' as const, margin: '25px 0' }}>
            <Button style={button} href={chatUrl}>
              View Message
            </Button>
          </Section>
        )}
        <Hr style={hr} />
        <Text style={footer}>Best regards, The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NewMessageNotificationEmail,
  subject: (data: Record<string, any>) =>
    data?.senderName ? `New message from ${data.senderName}` : 'You have a new message',
  displayName: 'New message notification',
  previewData: {
    senderName: 'Ahmed',
    messagePreview: 'Hello, I have a question about the lesson schedule.',
    chatUrl: 'https://cswworld.com/account?tab=messages',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', Arial, sans-serif" }
const container = { padding: '30px 25px', maxWidth: '520px', margin: '0 auto' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#1a1a2e', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 20px' }
const previewBox = { backgroundColor: '#f8f9fa', borderRadius: '8px', padding: '16px', margin: '0 0 20px', borderLeft: '3px solid #6366f1' }
const previewText = { fontSize: '14px', color: '#333', lineHeight: '1.5', margin: '0', fontStyle: 'italic' as const }
const button = {
  backgroundColor: '#6366f1', color: '#ffffff', padding: '12px 30px',
  borderRadius: '8px', fontSize: '14px', fontWeight: 'bold' as const,
  textDecoration: 'none', display: 'inline-block' as const,
}
const hr = { borderColor: '#eee', margin: '25px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '0' }
