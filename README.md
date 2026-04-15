# CSW Student Portal

A comprehensive platform for international student recruitment, program discovery, and application management.

## 🚀 Features

- **Smart Recommendations**: AI-powered program suggestions based on user behavior and preferences
- **Scholarship Discovery**: Curated scholarship listings with country and degree filtering
- **Application System**: Complete student application workflow with document management
- **Admin Dashboard**: Comprehensive control panel for managing universities, programs, and applications
- **CRM Integration**: Automated event synchronization with external CRM systems
- **WhatsApp Notifications**: Automated status updates via WhatsApp
- **Analytics**: Real-time tracking of user engagement and conversions

## 🏗️ Architecture

### Frontend
- **React 18** with TypeScript
- **TanStack Query** for data fetching
- **Tailwind CSS** for styling
- **React Router** for navigation

### Backend (Lovable Cloud)
- **Supabase** for database and authentication
- **Edge Functions** for serverless backend logic
- **Row Level Security (RLS)** for data protection
- **Real-time subscriptions** for live updates

## 📦 Environment Setup

The project uses environment variables managed automatically by Lovable Cloud:

```env
VITE_SUPABASE_URL=<auto-configured>
VITE_SUPABASE_PUBLISHABLE_KEY=<auto-configured>
VITE_SUPABASE_PROJECT_ID=<auto-configured>
```

### Required Secrets (Backend)

Configure these via Lovable Cloud settings:

- `CRM_URL` - Your CRM webhook endpoint
- `CRM_JWT_SECRET` - JWT secret for CRM authentication
- `HMAC_SHARED_SECRET` - For secure webhook verification
- `INTEGRATION_ENABLED` - Enable/disable CRM integration

## 🔧 Development

### Local Development

```bash
npm install
npm run dev
```

### Database Migrations

Database changes are managed through SQL migrations in `supabase/migrations/`:

```bash
# Migrations are automatically applied when deployed
```

### Edge Functions

Edge Functions are located in `supabase/functions/` and are automatically deployed:

- `recommend-programs` - Generate personalized program recommendations
- `scholarships-suggest` - Fetch relevant scholarships
- `apply-init` - Initialize application process
- `apply-upload-url` - Generate signed URLs for document uploads
- `notify-whatsapp` - Send WhatsApp notifications
- `bridge-flush` - Sync events to CRM

## 📊 Performance

### Caching Strategy

- **Recommendations**: 5-minute in-memory cache
- **Scholarships**: 10-minute in-memory cache
- **Static Data**: Browser cache for images and assets

### Rate Limiting

- Recommendations: 10 requests/minute per user
- Scholarships: 15 requests/minute per user
- Applications: 3 per 24 hours per visitor

## 🔐 Security

### Row Level Security (RLS)

All tables have RLS policies enforcing:
- Users can only access their own data
- Public data is read-only
- Admin operations require authentication

### API Security

- All Edge Functions validate input
- Rate limiting prevents abuse
- CORS configured for production domains
- JWT verification for admin endpoints

## 🏥 Monitoring

### Health Dashboard

Access system health at `/admin/health`:

- Integration error count
- Event queue status
- Notification queue length
- Last cron job execution

### Analytics

Track key metrics at `/admin/analytics`:

- Page views
- Chat sessions
- Lead generation
- Conversion rates

## 🔄 Integrations

### CRM Events

The following events are queued for CRM sync:

- `user.created` - New user registration
- `user.linked` - Visitor identified as user
- `application.created` - New application submitted
- `application.status_changed` - Status update
- `lead.created` - Phone number captured

### WhatsApp Notifications

Automated notifications for:

- Application status changes
- Document requests
- Interview scheduling
- Acceptance letters

## 📱 Admin Features

### SSO Authentication

Admin access uses JWT-based Single Sign-On:

```typescript
// Access token format
{
  "sub": "admin_id",
  "name": "Admin Name",
  "role": "admin",
  "exp": 1234567890
}
```

### Bulk Operations

- CSV import for universities and programs
- Batch scholarship approval
- Application status updates

## 🐛 Troubleshooting

### Common Issues

**Edge Functions Not Responding**

1. Check function logs in Lovable Cloud backend
2. Verify environment secrets are configured
3. Check rate limiting status

**Recommendations Not Showing**

1. Verify user has browsing history (events table)
2. Check `compute_recommendations` function
3. Refresh `programs_popularity` materialized view:

```sql
SELECT refresh_programs_popularity();
```

**WhatsApp Not Sending**

1. Verify `INTEGRATION_ENABLED` secret is 'true'
2. Check `notifications` table for queued messages
3. Review `integration_events` for errors

### Manual Cron Trigger

Refresh popularity manually:

```sql
SELECT * FROM cron.job;
```

Or via Edge Function:

```bash
curl -X POST <SUPABASE_URL>/functions/v1/refresh-popularity
```

## 📝 Release Checklist

Before deploying to production:

- [ ] All Edge Functions deployed and tested
- [ ] Database migrations applied
- [ ] Environment secrets configured
- [ ] RLS policies verified
- [ ] Rate limiting tested
- [ ] Health dashboard accessible
- [ ] Analytics tracking verified
- [ ] CRM integration tested
- [ ] WhatsApp notifications working
- [ ] Admin SSO functional

---

## QA Smoke Test (LAV #8)

Before deploying to production, verify these critical paths:

### 1. Country Pages
- Visit `/country/de` (or any country slug)
- ✅ Hero section displays with title/subtitle
- ✅ Country facts section shows (if configured)
- ✅ Top 8 universities display from `get_country_top_universities`
- ✅ Scholarships show (if any exist for this country)
- ✅ "Browse Programs" button redirects to `/search?country=<slug>&sort=ranking`

### 2. AI Assistant + Phone Linking
- Open home page assistant
- Send a message with filters: "Germany bachelor's English 12000"
- ✅ Filters update in real-time on the page
- ✅ `assistant_processed` event logged
- Send a phone number to assistant
- ✅ Phone stored in `phone_identities` table linked to visitor_id

### 3. Integration Events
- Navigate to Admin > Integration Logs
- Click "Flush Queued" button
- ✅ Events change status from `queued` → `acked` (if CRM is configured)
- ✅ No errors in integration_alerts table

### 4. Dynamic Sitemap
- Visit `/sitemap.xml`
- ✅ Contains `/country/:slug` entries for all countries
- ✅ Contains sample `/p/:id` program entries
- ✅ Has proper XML structure with `<lastmod>` tags
- ✅ Cache headers present (10 min cache)

### 5. Admin Tools
- Visit Admin > Countries
- ✅ "Preview" button opens `/country/:slug` in new tab
- ✅ "Edit SEO" dialog allows updating hero/seo fields
- ✅ Saving updates the country and closes dialog

### 6. Tracking Events
Check analytics/events table for these new events:
- `country_page_view` (when visiting country pages)
- `country_browse_programs_clicked` (when clicking Browse button)
- `assistant_processed` (when AI processes filters)
- Existing: `page_view`, `search_clicked`, `shortlist.updated`

---

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/9afecfe9-905b-4a66-96d9-4daf3e40dfbf) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/9afecfe9-905b-4a66-96d9-4daf3e40dfbf) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
