import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DollarSign } from "lucide-react";

export default function PaymentTest() {
  const [applicationId, setApplicationId] = useState("");
  const [amount, setAmount] = useState("100");
  const [paymentRef, setPaymentRef] = useState(`PAY-${Date.now()}`);
  const [loading, setLoading] = useState(false);

  const handleTestPayment = async () => {
    if (!applicationId || !amount) {
      toast.error("Please fill all fields");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("app_payment_success", {
        p_application_id: applicationId,
        p_payment_ref: paymentRef,
        p_amount: parseFloat(amount),
        p_currency: "USD"
      });

      if (error) throw error;

      toast.success("Payment processed successfully");
      console.log("Payment result:", data);
      
      // Reset for next test
      setPaymentRef(`PAY-${Date.now()}`);
    } catch (error) {
      console.error("Payment error:", error);
      toast.error("Failed to process payment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="max-w-2xl mx-auto p-6">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <DollarSign className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-bold">Payment Test Panel</h1>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="appId">Application ID</Label>
              <Input
                id="appId"
                type="text"
                value={applicationId}
                onChange={(e) => setApplicationId(e.target.value)}
                placeholder="Enter application UUID"
              />
            </div>

            <div>
              <Label htmlFor="amount">Amount (USD)</Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100.00"
              />
            </div>

            <div>
              <Label htmlFor="ref">Payment Reference</Label>
              <Input
                id="ref"
                type="text"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="PAY-123456"
              />
            </div>

            <Button
              onClick={handleTestPayment}
              disabled={loading}
              className="w-full"
            >
              {loading ? "Processing..." : "Simulate Payment Success"}
            </Button>

            <div className="p-4 bg-muted rounded text-sm">
              <p className="font-semibold mb-2">Test Instructions:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Get an application ID from the Applications page</li>
                <li>Enter the amount and reference</li>
                <li>Click "Simulate Payment Success"</li>
                <li>Check the application status and events timeline</li>
                <li>Verify WhatsApp/Email notification was queued</li>
              </ol>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
