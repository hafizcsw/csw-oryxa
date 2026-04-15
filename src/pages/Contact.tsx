import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { DSButton } from "@/components/design-system/DSButton";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { useToast } from "@/hooks/use-toast";

export default function ContactPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.message) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    // Track CTA click
    track("cta_contact_click", { page: "contact" });

    try {
      const EDGE_URL = import.meta.env.VITE_SUPABASE_URL;
      
      // Call web-lead-capture to create customer and get magic link
      const res = await fetch(`${EDGE_URL}/functions/v1/web-lead-capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: formData.name,
          email: formData.email,
          phone: formData.phone,
          program: formData.message, // Store message as interested program
          visitor_id: localStorage.getItem("visitor_id"),
          utm_source: new URLSearchParams(window.location.search).get("utm_source"),
          utm_campaign: new URLSearchParams(window.location.search).get("utm_campaign"),
          utm_medium: new URLSearchParams(window.location.search).get("utm_medium"),
        }),
      });

      const data = await res.json();

      if (data?.ok && data?.action_link) {
        // Track successful submission
        track("lead_submitted", { email: formData.email, source: "contact" });

        toast({
          title: "Message sent!",
          description: "Redirecting you to student portal..."
        });

        setFormData({ name: "", email: "", phone: "", message: "" });

        // Redirect to portal with magic link (session established)
        setTimeout(() => {
          window.location.href = data.action_link;
        }, 1500);
      } else {
        throw new Error(data?.error || "Failed to send message");
      }
    } catch (error) {
      console.error("Contact form error:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <section className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Contact Us</h1>
        <p className="text-muted-foreground mb-8">
          Have questions? We're here to help.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              className="w-full border rounded-xl px-4 py-2 bg-background"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Email <span className="text-destructive">*</span>
            </label>
            <input
              type="email"
              className="w-full border rounded-xl px-4 py-2 bg-background"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Phone
            </label>
            <input
              type="tel"
              className="w-full border rounded-xl px-4 py-2 bg-background"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Message <span className="text-destructive">*</span>
            </label>
            <textarea
              className="w-full border rounded-xl px-4 py-2 bg-background min-h-[150px]"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              required
            />
          </div>

          <DSButton type="submit" disabled={loading} className="w-full">
            {loading ? "Sending..." : "Send Message"}
          </DSButton>
        </form>
      </section>
    </Layout>
  );
}
