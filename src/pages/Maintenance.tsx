import { Layout } from "@/components/layout/Layout";

export default function MaintenancePage() {
  return (
    <Layout>
      <section className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="text-6xl mb-6">🔧</div>
        <h1 className="text-3xl font-bold mb-4">Under Maintenance</h1>
        <p className="text-muted-foreground mb-8">
          We're making some improvements. Please check back soon.
        </p>
        <p className="text-sm text-muted-foreground">
          Need urgent assistance? Contact us via WhatsApp or email.
        </p>
      </section>
    </Layout>
  );
}
