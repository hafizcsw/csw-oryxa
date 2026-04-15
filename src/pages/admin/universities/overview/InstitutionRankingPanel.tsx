import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Plus, Trash2, Star, Loader2 } from "lucide-react";

type InstitutionRankingPanelProps = {
  universityId: string;
};

type RankingRecord = {
  id: string;
  ranking_system: string;
  ranking_year: number;
  world_rank: number | null;
  national_rank: number | null;
  overall_score: number | null;
  teaching_score: number | null;
  employability_score: number | null;
  academic_reputation_score: number | null;
  research_score: number | null;
  source_url: string | null;
  is_primary: boolean;
};

const RANKING_SYSTEMS = [
  { value: 'qs', label: 'QS World Rankings' },
  { value: 'the', label: 'Times Higher Education' },
  { value: 'arwu', label: 'ARWU (Shanghai)' },
  { value: 'usnews', label: 'US News' },
  { value: 'cwur', label: 'CWUR' },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - i);

export default function InstitutionRankingPanel({ universityId }: InstitutionRankingPanelProps) {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [rankings, setRankings] = useState<RankingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // New ranking form state
  const [newRanking, setNewRanking] = useState({
    ranking_system: 'qs',
    ranking_year: CURRENT_YEAR,
    world_rank: '',
    national_rank: '',
    overall_score: '',
    teaching_score: '',
    employability_score: '',
    academic_reputation_score: '',
    research_score: '',
    source_url: '',
    is_primary: false,
  });

  useEffect(() => {
    loadRankings();
  }, [universityId]);

  const loadRankings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('institution_rankings')
      .select('*')
      .eq('institution_id', universityId)
      .order('ranking_year', { ascending: false });

    if (error) {
      toast({ 
        title: t('admin.ranking.error'), 
        description: error.message, 
        variant: "destructive" 
      });
    } else {
      setRankings(data || []);
    }
    setLoading(false);
  };

  const handleAddRanking = async () => {
    setSaving(true);
    
    const payload = {
      institution_id: universityId,
      ranking_system: newRanking.ranking_system,
      ranking_year: newRanking.ranking_year,
      world_rank: newRanking.world_rank ? parseInt(newRanking.world_rank) : null,
      national_rank: newRanking.national_rank ? parseInt(newRanking.national_rank) : null,
      overall_score: newRanking.overall_score ? parseFloat(newRanking.overall_score) : null,
      teaching_score: newRanking.teaching_score ? parseFloat(newRanking.teaching_score) : null,
      employability_score: newRanking.employability_score ? parseFloat(newRanking.employability_score) : null,
      academic_reputation_score: newRanking.academic_reputation_score ? parseFloat(newRanking.academic_reputation_score) : null,
      research_score: newRanking.research_score ? parseFloat(newRanking.research_score) : null,
      source_url: newRanking.source_url || null,
      is_primary: newRanking.is_primary,
    };

    const { error } = await supabase
      .from('institution_rankings')
      .insert(payload);

    if (error) {
      toast({ 
        title: t('admin.ranking.error'), 
        description: error.message, 
        variant: "destructive" 
      });
    } else {
      toast({ title: t('admin.ranking.added') });
      setShowAddForm(false);
      resetForm();
      loadRankings();
    }
    setSaving(false);
  };

  const handleDeleteRanking = async (id: string) => {
    const { error } = await supabase
      .from('institution_rankings')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ 
        title: t('admin.ranking.error'), 
        description: error.message, 
        variant: "destructive" 
      });
    } else {
      toast({ title: t('admin.ranking.deleted') });
      loadRankings();
    }
  };

  const handleSetPrimary = async (id: string) => {
    // First, unset all primary
    await supabase
      .from('institution_rankings')
      .update({ is_primary: false })
      .eq('institution_id', universityId);

    // Then set the selected one
    const { error } = await supabase
      .from('institution_rankings')
      .update({ is_primary: true })
      .eq('id', id);

    if (error) {
      toast({ 
        title: t('admin.ranking.error'), 
        description: error.message, 
        variant: "destructive" 
      });
    } else {
      toast({ title: t('admin.ranking.primarySet') });
      loadRankings();
    }
  };

  const resetForm = () => {
    setNewRanking({
      ranking_system: 'qs',
      ranking_year: CURRENT_YEAR,
      world_rank: '',
      national_rank: '',
      overall_score: '',
      teaching_score: '',
      employability_score: '',
      academic_reputation_score: '',
      research_score: '',
      source_url: '',
      is_primary: false,
    });
  };

  const getSystemLabel = (system: string) => {
    return RANKING_SYSTEMS.find(s => s.value === system)?.label || system;
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t('admin.ranking.loading')}</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Trophy className="h-5 w-5 text-primary" />
          <h4 className="font-semibold">{t('admin.ranking.title')}</h4>
        </div>
        <Button 
          size="sm" 
          onClick={() => setShowAddForm(!showAddForm)}
          variant={showAddForm ? "secondary" : "default"}
        >
          <Plus className="h-4 w-4" />
          <span className={language === 'ar' ? 'mr-2' : 'ml-2'}>
            {showAddForm ? t('common.cancel') : t('admin.ranking.addNew')}
          </span>
        </Button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="border rounded-lg p-4 mb-4 bg-muted/30 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* System & Year */}
            <div className="space-y-2">
              <Label>{t('admin.ranking.system')}</Label>
              <Select 
                value={newRanking.ranking_system}
                onValueChange={(v) => setNewRanking(prev => ({ ...prev, ranking_system: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RANKING_SYSTEMS.map(sys => (
                    <SelectItem key={sys.value} value={sys.value}>
                      {sys.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>{t('admin.ranking.year')}</Label>
              <Select 
                value={String(newRanking.ranking_year)}
                onValueChange={(v) => setNewRanking(prev => ({ ...prev, ranking_year: parseInt(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map(year => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ranks */}
            <div className="space-y-2">
              <Label>{t('admin.ranking.worldRank')}</Label>
              <Input
                type="number"
                min={1}
                value={newRanking.world_rank}
                onChange={(e) => setNewRanking(prev => ({ ...prev, world_rank: e.target.value }))}
                placeholder="150"
              />
            </div>
            
            <div className="space-y-2">
              <Label>{t('admin.ranking.nationalRank')}</Label>
              <Input
                type="number"
                min={1}
                value={newRanking.national_rank}
                onChange={(e) => setNewRanking(prev => ({ ...prev, national_rank: e.target.value }))}
                placeholder="5"
              />
            </div>
          </div>

          {/* Scores */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t('admin.ranking.overallScore')}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={newRanking.overall_score}
                onChange={(e) => setNewRanking(prev => ({ ...prev, overall_score: e.target.value }))}
                placeholder="85.5"
              />
            </div>
            
            <div className="space-y-2">
              <Label>{t('admin.ranking.teachingScore')}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={newRanking.teaching_score}
                onChange={(e) => setNewRanking(prev => ({ ...prev, teaching_score: e.target.value }))}
                placeholder="80.0"
              />
            </div>
            
            <div className="space-y-2">
              <Label>{t('admin.ranking.employabilityScore')}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={newRanking.employability_score}
                onChange={(e) => setNewRanking(prev => ({ ...prev, employability_score: e.target.value }))}
                placeholder="75.0"
              />
            </div>
            
            <div className="space-y-2">
              <Label>{t('admin.ranking.academicReputation')}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={newRanking.academic_reputation_score}
                onChange={(e) => setNewRanking(prev => ({ ...prev, academic_reputation_score: e.target.value }))}
                placeholder="90.0"
              />
            </div>
            
            <div className="space-y-2">
              <Label>{t('admin.ranking.researchScore')}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={newRanking.research_score}
                onChange={(e) => setNewRanking(prev => ({ ...prev, research_score: e.target.value }))}
                placeholder="70.0"
              />
            </div>
          </div>

          {/* Source & Primary */}
          <div className="grid grid-cols-2 gap-4 items-end">
            <div className="space-y-2">
              <Label>{t('admin.ranking.sourceUrl')}</Label>
              <Input
                type="url"
                value={newRanking.source_url}
                onChange={(e) => setNewRanking(prev => ({ ...prev, source_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            
            <div className="flex items-center gap-3">
              <Switch
                checked={newRanking.is_primary}
                onCheckedChange={(v) => setNewRanking(prev => ({ ...prev, is_primary: v }))}
              />
              <Label>{t('admin.ranking.setPrimary')}</Label>
            </div>
          </div>

          <Button onClick={handleAddRanking} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('admin.ranking.save')}
          </Button>
        </div>
      )}

      {/* Rankings List */}
      {rankings.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('admin.ranking.noRankings')}</p>
      ) : (
        <div className="space-y-3">
          {rankings.map(ranking => (
            <div 
              key={ranking.id} 
              className="flex items-center justify-between p-3 border rounded-lg bg-card"
            >
              <div className="flex items-center gap-3">
                {ranking.is_primary && (
                  <Star className="h-4 w-4 text-primary fill-primary" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{getSystemLabel(ranking.ranking_system)}</span>
                    <Badge variant="outline">{ranking.ranking_year}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground flex gap-4 mt-1">
                    {ranking.world_rank && (
                      <span>{t('admin.ranking.world')}: #{ranking.world_rank}</span>
                    )}
                    {ranking.national_rank && (
                      <span>{t('admin.ranking.national')}: #{ranking.national_rank}</span>
                    )}
                    {ranking.overall_score && (
                      <span>{t('admin.ranking.score')}: {ranking.overall_score}</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {!ranking.is_primary && (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => handleSetPrimary(ranking.id)}
                    title={t('admin.ranking.setPrimary')}
                  >
                    <Star className="h-4 w-4" />
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => handleDeleteRanking(ranking.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
