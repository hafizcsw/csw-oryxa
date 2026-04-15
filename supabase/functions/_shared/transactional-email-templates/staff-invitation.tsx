import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "CSW World"

interface StaffInvitationProps {
  universityName?: string
  roleName?: string
  inviterName?: string
  acceptUrl?: string
}

const StaffInvitationEmail = ({ universityName, roleName, inviterName, acceptUrl }: StaffInvitationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to join {universityName || 'a university'} on {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          Staff Invitation
        </Heading>
        <Text style={text}>
          {inviterName ? `${inviterName} has` : 'You have been'} invited you to join <strong>{universityName || 'a university'}</strong> as <strong>{roleName || 'staff'}</strong> on {SITE_NAME}.
        </Text>
        <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
          <Button style={button} href={acceptUrl || '#'}>
            Accept Invitation
          </Button>
        </Section>
        <Hr style={hr} />
        <Text style={footerText}>
          This invitation expires in 7 days. If you did not expect this invitation, you can safely ignore this email.
        </Text>
        <Text style={footerText}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: StaffInvitationEmail,
  subject: (data: Record<string, any>) => `Staff invitation: ${data.universityName || 'University'} on ${SITE_NAME}`,
  displayName: 'Staff Invitation',
  previewData: { universityName: 'University of Cambridge', roleName: 'Page Admin', inviterName: 'Ahmad', acceptUrl: 'https://cswworld.com/accept-invite?token=abc123' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const button = {
  backgroundColor: '#c8a45a', color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const,
  padding: '12px 32px', borderRadius: '6px', textDecoration: 'none',
}
const hr = { borderColor: '#e5e5e5', margin: '24px 0' }
const footerText = { fontSize: '12px', color: '#999999', margin: '4px 0', lineHeight: '1.5' }
