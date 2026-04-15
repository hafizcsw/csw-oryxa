import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { trackApplicationSubmitted, trackDocUploaded, trackPaymentStart } from "@/lib/decisionTracking";
import { useUnifiedShortlist } from "@/hooks/useUnifiedShortlist";
import { AlertCircle, CheckCircle, Upload, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

const DOC_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "transcript", label: "Academic Transcript" },
  { value: "ielts", label: "IELTS/TOEFL Certificate" },
  { value: "cv", label: "CV/Resume" },
  { value: "other", label: "Other" },
];

export default function Apply() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [visitorId] = useState(() => localStorage.getItem('visitor_id') || '');
  
  // ✅ Use unified shortlist from context
  const { shortlist } = useUnifiedShortlist();
  
  const [countries, setCountries] = useState<any[]>([]);
  const [degrees, setDegrees] = useState<any[]>([]);
  
  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [countrySlug, setCountrySlug] = useState("");
  const [degreeSlug, setDegreeSlug] = useState("");
  const [language, setLanguage] = useState("EN");
  const [budgetFees, setBudgetFees] = useState<number>(5000);
  const [budgetLiving, setBudgetLiving] = useState<number>(1000);
  
  // Application state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  
  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("passport");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedDocs, setUploadedDocs] = useState<any[]>([]);

  useEffect(() => {
    track('apply_opened');
    
    // Prefill from search filters if available
    const filters = localStorage.getItem('searchFilters');
    if (filters) {
      try {
        const parsed = JSON.parse(filters);
        if (parsed.country) setCountrySlug(parsed.country);
        if (parsed.degree) setDegreeSlug(parsed.degree);
        if (parsed.language) setLanguage(parsed.language);
        if (parsed.fees_max) setBudgetFees(parsed.fees_max);
        if (parsed.living_max) setBudgetLiving(parsed.living_max);
      } catch (e) {
        console.error('Failed to parse filters', e);
      }
    }

    // Load countries and degrees for dropdowns
    loadMetadata();
  }, []);

  const loadMetadata = async () => {
    const [countriesRes, degreesRes] = await Promise.all([
      supabase.from('countries').select('name,slug').order('name'),
      supabase.from('degrees').select('name,slug').order('name'),
    ]);

    if (countriesRes.data) setCountries(countriesRes.data);
    if (degreesRes.data) setDegrees(degreesRes.data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fullName || !email || !phone) {
      toast.error("Please fill all required fields");
      return;
    }

    if (shortlist.length === 0) {
      toast.error("Please select at least one program from search");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('apply-init', {
        body: {
          visitor_id: visitorId,
          full_name: fullName,
          email,
          phone,
          country_slug: countrySlug,
          degree_slug: degreeSlug,
          language,
          budget_fees: budgetFees,
          budget_living: budgetLiving,
          program_ids: shortlist,
        }
      });

      if (error) throw error;

      if (data?.ok && data?.application_id) {
        setApplicationId(data.application_id);
        track('apply_submitted', { 
          application_id: data.application_id, 
          programs: shortlist.length 
        });
        // ✅ Decision tracking: application submitted
        trackApplicationSubmitted(data.application_id);
        toast.success("تم إرسال الطلب بنجاح! يمكنك الآن رفع المستندات.");
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error: any) {
      console.error('Apply error:', error);
      toast.error(error.message || "Failed to submit application");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !applicationId) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Get signed upload URL
      const { data: urlData, error: urlError } = await supabase.functions.invoke('apply-upload-url', {
        body: {
          application_id: applicationId,
          filename: selectedFile.name,
          mime: selectedFile.type,
          file_size: selectedFile.size
        }
      });

      if (urlError) throw urlError;

      setUploadProgress(30);

      // Step 2: Upload file using Supabase SDK
      const { error: uploadError } = await supabase
        .storage
        .from('applications')
        .uploadToSignedUrl(urlData.storage_path, urlData.token, selectedFile);

      if (uploadError) throw uploadError;

      setUploadProgress(70);

      // Step 3: Attach document metadata
      const { data: attachData, error: attachError } = await supabase.functions.invoke('apply-doc-attach', {
        body: {
          application_id: applicationId,
          storage_path: urlData.storage_path,
          original_name: selectedFile.name,
          mime_type: selectedFile.type,
          file_size: selectedFile.size,
          doc_type: docType,
        }
      });

      if (attachError) throw attachError;

      setUploadProgress(100);
      
      track('apply_doc_uploaded', { 
        application_id: applicationId,
        type: docType,
        size: selectedFile.size 
      });
      // ✅ Decision tracking: doc uploaded
      trackDocUploaded(docType);

      toast.success(`${selectedFile.name} uploaded successfully!`);
      
      setUploadedDocs([...uploadedDocs, {
        name: selectedFile.name,
        type: docType,
        size: selectedFile.size
      }]);

      // Reset
      setSelectedFile(null);
      setUploadProgress(0);
      
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || "Failed to upload document");
    } finally {
      setIsUploading(false);
    }
  };

  if (shortlist.length === 0 && !applicationId) {
    return (
      <Layout>
        <div className="container py-12">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No programs selected. Please go to <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/universities?tab=programs')}>Search</Button> and add programs to your shortlist first.
            </AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-12 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">Apply Now</h1>
        <p className="text-muted-foreground mb-8">
          Submit your application for {shortlist.length} selected program(s)
        </p>

        {!applicationId ? (
          <Card>
            <CardHeader>
              <CardTitle>Application Form</CardTitle>
              <CardDescription>Fill in your details to proceed</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input 
                    id="fullName" 
                    value={fullName} 
                    onChange={(e) => setFullName(e.target.value)}
                    required 
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                    required 
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone (with country code) *</Label>
                  <Input 
                    id="phone" 
                    type="tel" 
                    placeholder="+966..." 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)}
                    required 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="country">Preferred Country</Label>
                    <Select value={countrySlug} onValueChange={setCountrySlug}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {countries.map(c => (
                          <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="degree">Study Level</Label>
                    <Select value={degreeSlug} onValueChange={setDegreeSlug}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        {degrees.map(d => (
                          <SelectItem key={d.slug} value={d.slug}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Annual Fees Budget (USD)</Label>
                    <Input 
                      type="number" 
                      value={budgetFees} 
                      onChange={(e) => setBudgetFees(Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <Label>Monthly Living Budget (USD)</Label>
                    <Input 
                      type="number" 
                      value={budgetLiving} 
                      onChange={(e) => setBudgetLiving(Number(e.target.value))}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Application"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                تم إرسال الطلب بنجاح! رقم الطلب: <strong>{applicationId.slice(0, 8)}...</strong>
                <br />
                سيتم التواصل معك عبر واتساب أو الهاتف قريباً.
                <br />
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-green-700 mt-2"
                  onClick={() => navigate(`/status/${applicationId}`)}
                >
                  عرض حالة الطلب ←
                </Button>
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle>Upload Documents</CardTitle>
                <CardDescription>
                  Upload your passport, transcripts, certificates, etc. (PDF, JPG, PNG - max 10MB each)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="docType">Document Type</Label>
                  <Select value={docType} onValueChange={setDocType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map(dt => (
                        <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="file">Select File</Label>
                  <Input 
                    id="file" 
                    type="file" 
                    onChange={handleFileSelect}
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  />
                </div>

                {selectedFile && (
                  <div className="text-sm text-muted-foreground">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                )}

                {isUploading && (
                  <Progress value={uploadProgress} className="w-full" />
                )}

                <Button 
                  onClick={handleUpload} 
                  disabled={!selectedFile || isUploading}
                  className="w-full"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading... {uploadProgress}%
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Document
                    </>
                  )}
                </Button>

                {uploadedDocs.length > 0 && (
                  <div className="mt-6">
                    <h3 className="font-semibold mb-2">Uploaded Documents:</h3>
                    <div className="space-y-2">
                      {uploadedDocs.map((doc, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <FileText className="h-4 w-4" />
                          <span>{doc.name}</span>
                          <span className="text-muted-foreground">({doc.type})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Alert>
              <AlertDescription>
                <strong>Next Steps:</strong> Our team will review your application and documents. You'll receive updates via WhatsApp.
                <br />
                <Button 
                  variant="link" 
                  className="p-0 h-auto mt-2"
                  onClick={() => window.open(`https://wa.me/?text=My application ID: ${applicationId}`, '_blank')}
                >
                  Contact us on WhatsApp →
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>
    </Layout>
  );
}
