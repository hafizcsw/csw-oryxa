export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_audit: {
        Row: {
          action: string | null
          admin_id: string | null
          at: string | null
          diff: Json | null
          id: number
          row_key: string | null
          table_name: string | null
        }
        Insert: {
          action?: string | null
          admin_id?: string | null
          at?: string | null
          diff?: Json | null
          id?: number
          row_key?: string | null
          table_name?: string | null
        }
        Update: {
          action?: string | null
          admin_id?: string | null
          at?: string | null
          diff?: Json | null
          id?: number
          row_key?: string | null
          table_name?: string | null
        }
        Relationships: []
      }
      admission_rules_country: {
        Row: {
          citizenship_country_code: string | null
          country_code: string
          created_at: string
          curriculum: string
          degree_slug: string | null
          discipline_slug: string | null
          is_active: boolean
          priority: number
          requirement_set: Json
          rule_id: string
          stream: string
        }
        Insert: {
          citizenship_country_code?: string | null
          country_code: string
          created_at?: string
          curriculum: string
          degree_slug?: string | null
          discipline_slug?: string | null
          is_active?: boolean
          priority?: number
          requirement_set: Json
          rule_id?: string
          stream: string
        }
        Update: {
          citizenship_country_code?: string | null
          country_code?: string
          created_at?: string
          curriculum?: string
          degree_slug?: string | null
          discipline_slug?: string | null
          is_active?: boolean
          priority?: number
          requirement_set?: Json
          rule_id?: string
          stream?: string
        }
        Relationships: []
      }
      admission_rules_program: {
        Row: {
          created_at: string
          is_active: boolean
          program_id: string
          requirement_set: Json
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          program_id: string
          requirement_set: Json
        }
        Update: {
          created_at?: string
          is_active?: boolean
          program_id?: string
          requirement_set?: Json
        }
        Relationships: []
      }
      admission_rules_university: {
        Row: {
          created_at: string
          is_active: boolean
          priority: number
          requirement_set: Json
          university_id: string
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          priority?: number
          requirement_set: Json
          university_id: string
        }
        Update: {
          created_at?: string
          is_active?: boolean
          priority?: number
          requirement_set?: Json
          university_id?: string
        }
        Relationships: []
      }
      admissions_consensus: {
        Row: {
          audience: string | null
          confidence_score: number | null
          consensus_min_gpa: number | null
          consensus_min_ielts: number | null
          consensus_min_toefl: number | null
          consensus_other_requirements: Json | null
          created_at: string | null
          degree_level: string | null
          id: string
          is_stale: boolean | null
          last_updated_at: string | null
          observations_count: number | null
          program_id: string | null
          university_id: string | null
        }
        Insert: {
          audience?: string | null
          confidence_score?: number | null
          consensus_min_gpa?: number | null
          consensus_min_ielts?: number | null
          consensus_min_toefl?: number | null
          consensus_other_requirements?: Json | null
          created_at?: string | null
          degree_level?: string | null
          id?: string
          is_stale?: boolean | null
          last_updated_at?: string | null
          observations_count?: number | null
          program_id?: string | null
          university_id?: string | null
        }
        Update: {
          audience?: string | null
          confidence_score?: number | null
          consensus_min_gpa?: number | null
          consensus_min_ielts?: number | null
          consensus_min_toefl?: number | null
          consensus_other_requirements?: Json | null
          created_at?: string | null
          degree_level?: string | null
          id?: string
          is_stale?: boolean | null
          last_updated_at?: string | null
          observations_count?: number | null
          program_id?: string | null
          university_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admissions_consensus_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "admissions_consensus_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_consensus_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "admissions_consensus_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "admissions_consensus_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "admissions_consensus_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "admissions_consensus_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "admissions_consensus_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "admissions_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "admissions_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "admissions_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "admissions_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "admissions_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "admissions_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "admissions_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "admissions_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "admissions_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "admissions_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      admissions_observations: {
        Row: {
          audience: string | null
          confidence: number | null
          created_at: string | null
          degree_level: string | null
          id: string
          min_gpa: number | null
          min_ielts: number | null
          min_toefl: number | null
          observed_at: string | null
          other_requirements: Json | null
          program_id: string | null
          source_id: string | null
          source_url: string | null
          university_id: string | null
        }
        Insert: {
          audience?: string | null
          confidence?: number | null
          created_at?: string | null
          degree_level?: string | null
          id?: string
          min_gpa?: number | null
          min_ielts?: number | null
          min_toefl?: number | null
          observed_at?: string | null
          other_requirements?: Json | null
          program_id?: string | null
          source_id?: string | null
          source_url?: string | null
          university_id?: string | null
        }
        Update: {
          audience?: string | null
          confidence?: number | null
          created_at?: string | null
          degree_level?: string | null
          id?: string
          min_gpa?: number | null
          min_ielts?: number | null
          min_toefl?: number | null
          observed_at?: string | null
          other_requirements?: Json | null
          program_id?: string | null
          source_id?: string | null
          source_url?: string | null
          university_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admissions_observations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "admissions_observations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_observations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "admissions_observations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "admissions_observations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "admissions_observations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "admissions_observations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "admissions_observations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "admissions_observations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "admissions_observations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "admissions_observations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_observations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "admissions_observations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "admissions_observations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "admissions_observations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "admissions_observations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "admissions_observations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_observations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "admissions_observations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "admissions_observations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_enrichment_jobs: {
        Row: {
          created_at: string | null
          created_by: string | null
          error: string | null
          id: string
          result: Json | null
          source_urls: Json | null
          status: string
          target_id: string | null
          target_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          error?: string | null
          id?: string
          result?: Json | null
          source_urls?: Json | null
          status?: string
          target_id?: string | null
          target_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          error?: string | null
          id?: string
          result?: Json | null
          source_urls?: Json | null
          status?: string
          target_id?: string | null
          target_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_enrichment_suggestions: {
        Row: {
          approved_by: string | null
          confidence: number | null
          created_at: string | null
          field: string
          id: string
          job_id: string | null
          proposed_value: Json
          status: string
        }
        Insert: {
          approved_by?: string | null
          confidence?: number | null
          created_at?: string | null
          field: string
          id?: string
          job_id?: string | null
          proposed_value: Json
          status?: string
        }
        Update: {
          approved_by?: string | null
          confidence?: number | null
          created_at?: string | null
          field?: string
          id?: string
          job_id?: string | null
          proposed_value?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_enrichment_suggestions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ai_enrichment_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_extractions: {
        Row: {
          content_hash: string | null
          created_at: string | null
          entity_type: string | null
          error_message: string | null
          id: number
          model: string
          prompt_sha256: string | null
          prompt_version: string | null
          provider: string
          request_id: string | null
          status: string | null
          target_id: string | null
          usage: Json | null
        }
        Insert: {
          content_hash?: string | null
          created_at?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: number
          model: string
          prompt_sha256?: string | null
          prompt_version?: string | null
          provider?: string
          request_id?: string | null
          status?: string | null
          target_id?: string | null
          usage?: Json | null
        }
        Update: {
          content_hash?: string | null
          created_at?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: number
          model?: string
          prompt_sha256?: string | null
          prompt_version?: string | null
          provider?: string
          request_id?: string | null
          status?: string | null
          target_id?: string | null
          usage?: Json | null
        }
        Relationships: []
      }
      ai_validation_runs: {
        Row: {
          check_kind: string
          country_code: string | null
          entity_id: string
          entity_type: string
          id: number
          notes: string | null
          observed: Json | null
          observed_at: string | null
          run_id: string | null
          score: number | null
          source_type: string | null
          source_url: string | null
          verdict: string
        }
        Insert: {
          check_kind: string
          country_code?: string | null
          entity_id: string
          entity_type: string
          id?: number
          notes?: string | null
          observed?: Json | null
          observed_at?: string | null
          run_id?: string | null
          score?: number | null
          source_type?: string | null
          source_url?: string | null
          verdict: string
        }
        Update: {
          check_kind?: string
          country_code?: string | null
          entity_id?: string
          entity_type?: string
          id?: number
          notes?: string | null
          observed?: Json | null
          observed_at?: string | null
          run_id?: string | null
          score?: number | null
          source_type?: string | null
          source_url?: string | null
          verdict?: string
        }
        Relationships: []
      }
      analytics_daily: {
        Row: {
          chats: number
          day: string
          leads: number
          page_views: number
          service_clicks: number
        }
        Insert: {
          chats?: number
          day: string
          leads?: number
          page_views?: number
          service_clicks?: number
        }
        Update: {
          chats?: number
          day?: string
          leads?: number
          page_views?: number
          service_clicks?: number
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          at: string
          event: string
          id: number
          ip: unknown
          latency_ms: number | null
          payload: Json | null
          route: string | null
          session_id: string | null
          tab: string
          user_id: string | null
        }
        Insert: {
          at?: string
          event: string
          id?: number
          ip?: unknown
          latency_ms?: number | null
          payload?: Json | null
          route?: string | null
          session_id?: string | null
          tab: string
          user_id?: string | null
        }
        Update: {
          at?: string
          event?: string
          id?: number
          ip?: unknown
          latency_ms?: number | null
          payload?: Json | null
          route?: string | null
          session_id?: string | null
          tab?: string
          user_id?: string | null
        }
        Relationships: []
      }
      application_documents: {
        Row: {
          application_id: string
          created_at: string | null
          doc_type: string | null
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          original_name: string | null
          status: string | null
        }
        Insert: {
          application_id: string
          created_at?: string | null
          doc_type?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          original_name?: string | null
          status?: string | null
        }
        Update: {
          application_id?: string
          created_at?: string | null
          doc_type?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          original_name?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      application_items: {
        Row: {
          application_id: string
          program_id: string | null
          university_id: string
        }
        Insert: {
          application_id: string
          program_id?: string | null
          university_id: string
        }
        Update: {
          application_id?: string
          program_id?: string | null
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_items_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      application_programs: {
        Row: {
          application_id: string
          created_at: string | null
          id: string
          program_id: string
        }
        Insert: {
          application_id: string
          created_at?: string | null
          id?: string
          program_id: string
        }
        Update: {
          application_id?: string
          created_at?: string | null
          id?: string
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_programs_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "application_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "application_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "application_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "application_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "application_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "application_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["program_id"]
          },
        ]
      }
      application_reminders: {
        Row: {
          created_at: string | null
          id: string
          program_id: string
          remind_at: string
          sent: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          program_id: string
          remind_at: string
          sent?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          program_id?: string
          remind_at?: string
          sent?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_reminders_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "application_reminders_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_reminders_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "application_reminders_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "application_reminders_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "application_reminders_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "application_reminders_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "application_reminders_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "application_reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      application_status_events: {
        Row: {
          application_id: string
          channel: string | null
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          status: string
        }
        Insert: {
          application_id: string
          channel?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          status: string
        }
        Update: {
          application_id?: string
          channel?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_status_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          budget_fees: number | null
          budget_living: number | null
          country_slug: string | null
          created_at: string | null
          degree_slug: string | null
          email: string | null
          full_name: string | null
          id: string
          language: string | null
          notes: string | null
          phone: string | null
          source: string | null
          status: string | null
          user_id: string | null
          visitor_id: string
        }
        Insert: {
          budget_fees?: number | null
          budget_living?: number | null
          country_slug?: string | null
          created_at?: string | null
          degree_slug?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          language?: string | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string | null
          user_id?: string | null
          visitor_id: string
        }
        Update: {
          budget_fees?: number | null
          budget_living?: number | null
          country_slug?: string | null
          created_at?: string | null
          degree_slug?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          language?: string | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string | null
          user_id?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      catalog_ingest_cursor: {
        Row: {
          created_at: string
          key: string
          last_run_at: string | null
          last_trace_id: string | null
          meta: Json
          page: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          key: string
          last_run_at?: string | null
          last_trace_id?: string | null
          meta?: Json
          page?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          key?: string
          last_run_at?: string | null
          last_trace_id?: string | null
          meta?: Json
          page?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      certificate_types: {
        Row: {
          id: string
          name: string
          slug: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          meta: Json | null
          role: string
          session_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          meta?: Json | null
          role: string
          session_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          meta?: Json | null
          role?: string
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          channel: string | null
          created_at: string | null
          crm_contact_id: string | null
          id: string
          user_id: string | null
          visitor_id: string
        }
        Insert: {
          channel?: string | null
          created_at?: string | null
          crm_contact_id?: string | null
          id?: string
          user_id?: string | null
          visitor_id: string
        }
        Update: {
          channel?: string | null
          created_at?: string | null
          crm_contact_id?: string | null
          id?: string
          user_id?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      city_backfill_csv: {
        Row: {
          city: string
          country_name: string | null
          id: number
          university_name: string
        }
        Insert: {
          city: string
          country_name?: string | null
          id?: number
          university_name: string
        }
        Update: {
          city?: string
          country_name?: string | null
          id?: number
          university_name?: string
        }
        Relationships: []
      }
      city_backfill_staging: {
        Row: {
          applied_at: string | null
          confidence_score: number | null
          country_code: string | null
          created_at: string
          id: string
          old_city: string | null
          proposed_city: string | null
          reasoning: Json | null
          source_method: string | null
          status: string
          trace_id: string | null
          university_id: string
          university_name: string | null
        }
        Insert: {
          applied_at?: string | null
          confidence_score?: number | null
          country_code?: string | null
          created_at?: string
          id?: string
          old_city?: string | null
          proposed_city?: string | null
          reasoning?: Json | null
          source_method?: string | null
          status?: string
          trace_id?: string | null
          university_id: string
          university_name?: string | null
        }
        Update: {
          applied_at?: string | null
          confidence_score?: number | null
          country_code?: string | null
          created_at?: string
          id?: string
          old_city?: string | null
          proposed_city?: string | null
          reasoning?: Json | null
          source_method?: string | null
          status?: string
          trace_id?: string | null
          university_id?: string
          university_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "city_backfill_staging_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "city_backfill_staging_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "city_backfill_staging_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "city_backfill_staging_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "city_backfill_staging_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "city_backfill_staging_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "city_backfill_staging_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "city_backfill_staging_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "city_backfill_staging_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "city_backfill_staging_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "city_backfill_staging_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "city_backfill_staging_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      city_coordinates: {
        Row: {
          city_name: string
          country_code: string
          id: number
          lat: number
          lon: number
        }
        Insert: {
          city_name: string
          country_code: string
          id?: number
          lat: number
          lon: number
        }
        Update: {
          city_name?: string
          country_code?: string
          id?: number
          lat?: number
          lon?: number
        }
        Relationships: []
      }
      city_enrichment: {
        Row: {
          city_name: string
          climate_summary_i18n: Json | null
          country_code: string
          created_at: string | null
          data_source: string | null
          healthcare_score: number | null
          id: string
          internet_speed_mbps: number | null
          last_updated_at: string | null
          living_cost_monthly_usd: number | null
          quality_of_life_score: number | null
          rent_monthly_usd: number | null
          safety_score: number | null
          transport_score: number | null
        }
        Insert: {
          city_name: string
          climate_summary_i18n?: Json | null
          country_code: string
          created_at?: string | null
          data_source?: string | null
          healthcare_score?: number | null
          id?: string
          internet_speed_mbps?: number | null
          last_updated_at?: string | null
          living_cost_monthly_usd?: number | null
          quality_of_life_score?: number | null
          rent_monthly_usd?: number | null
          safety_score?: number | null
          transport_score?: number | null
        }
        Update: {
          city_name?: string
          climate_summary_i18n?: Json | null
          country_code?: string
          created_at?: string | null
          data_source?: string | null
          healthcare_score?: number | null
          id?: string
          internet_speed_mbps?: number | null
          last_updated_at?: string | null
          living_cost_monthly_usd?: number | null
          quality_of_life_score?: number | null
          rent_monthly_usd?: number | null
          safety_score?: number | null
          transport_score?: number | null
        }
        Relationships: []
      }
      comm_messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          body: string
          created_at: string
          id: string
          sender_id: string
          sender_role: Database["public"]["Enums"]["comm_participant_role"]
          thread_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          body: string
          created_at?: string
          id?: string
          sender_id: string
          sender_role?: Database["public"]["Enums"]["comm_participant_role"]
          thread_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          body?: string
          created_at?: string
          id?: string
          sender_id?: string
          sender_role?: Database["public"]["Enums"]["comm_participant_role"]
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comm_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "comm_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_thread_participants: {
        Row: {
          id: string
          joined_at: string
          last_read_at: string | null
          role: Database["public"]["Enums"]["comm_participant_role"]
          thread_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          last_read_at?: string | null
          role?: Database["public"]["Enums"]["comm_participant_role"]
          thread_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          last_read_at?: string | null
          role?: Database["public"]["Enums"]["comm_participant_role"]
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comm_thread_participants_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "comm_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_threads: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          linked_entity_id: string | null
          linked_entity_type: string | null
          priority: Database["public"]["Enums"]["comm_thread_priority"]
          status: Database["public"]["Enums"]["comm_thread_status"]
          subject: string | null
          thread_type: Database["public"]["Enums"]["comm_thread_type"]
          university_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          priority?: Database["public"]["Enums"]["comm_thread_priority"]
          status?: Database["public"]["Enums"]["comm_thread_status"]
          subject?: string | null
          thread_type: Database["public"]["Enums"]["comm_thread_type"]
          university_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          priority?: Database["public"]["Enums"]["comm_thread_priority"]
          status?: Database["public"]["Enums"]["comm_thread_status"]
          subject?: string | null
          thread_type?: Database["public"]["Enums"]["comm_thread_type"]
          university_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comm_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "comm_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "comm_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "comm_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "comm_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "comm_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "comm_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "comm_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "comm_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "comm_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          author_type: string
          author_user_id: string | null
          comments_count: number
          content: string
          created_at: string
          id: string
          image_url: string | null
          is_pinned: boolean
          likes_count: number
          tags: string[] | null
          university_id: string | null
          updated_at: string
        }
        Insert: {
          author_type: string
          author_user_id?: string | null
          comments_count?: number
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_pinned?: boolean
          likes_count?: number
          tags?: string[] | null
          university_id?: string | null
          updated_at?: string
        }
        Update: {
          author_type?: string
          author_user_id?: string | null
          comments_count?: number
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_pinned?: boolean
          likes_count?: number
          tags?: string[] | null
          university_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "community_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "community_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "community_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "community_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "community_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "community_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "community_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "community_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "community_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_signatures: {
        Row: {
          contract_id: string | null
          id: string
          ip: string | null
          method: string | null
          signature_image_path: string | null
          signed_at: string | null
          signer_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          contract_id?: string | null
          id?: string
          ip?: string | null
          method?: string | null
          signature_image_path?: string | null
          signed_at?: string | null
          signer_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          contract_id?: string | null
          id?: string
          ip?: string | null
          method?: string | null
          signature_image_path?: string | null
          signed_at?: string | null
          signer_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_signatures_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          body_html: string
          created_at: string | null
          id: string
          is_active: boolean | null
          title: string
          version: number | null
        }
        Insert: {
          body_html: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          title: string
          version?: number | null
        }
        Update: {
          body_html?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          title?: string
          version?: number | null
        }
        Relationships: []
      }
      contracts: {
        Row: {
          created_at: string | null
          data: Json | null
          html_render: string | null
          id: string
          pdf_path: string | null
          signed_at: string | null
          status: string | null
          student_user_id: string
          template_id: string | null
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          html_render?: string | null
          id?: string
          pdf_path?: string | null
          signed_at?: string | null
          status?: string | null
          student_user_id: string
          template_id?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          html_render?: string | null
          id?: string
          pdf_path?: string | null
          signed_at?: string | null
          status?: string | null
          student_user_id?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      counselor_assignments: {
        Row: {
          application_id: string
          assigned_by: string | null
          created_at: string | null
          user_id: string
        }
        Insert: {
          application_id: string
          assigned_by?: string | null
          created_at?: string | null
          user_id: string
        }
        Update: {
          application_id?: string
          assigned_by?: string | null
          created_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "counselor_assignments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "counselor_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "counselor_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      counselor_notes: {
        Row: {
          application_id: string
          author_id: string | null
          created_at: string | null
          id: string
          note: string
          visibility: string
        }
        Insert: {
          application_id: string
          author_id?: string | null
          created_at?: string | null
          id?: string
          note: string
          visibility?: string
        }
        Update: {
          application_id?: string
          author_id?: string | null
          created_at?: string | null
          id?: string
          note?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "counselor_notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "counselor_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      countries: {
        Row: {
          country_code: string
          currency_code: string | null
          display_order: number | null
          education_rank_global: number | null
          id: string
          image_url: string | null
          international_students: number | null
          map_embed_url: string | null
          name_ar: string
          name_en: string | null
          page_content: string | null
          rich_content: Json | null
          seo_canonical_url: string | null
          seo_description: string | null
          seo_h1: string | null
          seo_index: boolean | null
          seo_last_reviewed_at: string | null
          seo_title: string | null
          slug: string
        }
        Insert: {
          country_code: string
          currency_code?: string | null
          display_order?: number | null
          education_rank_global?: number | null
          id?: string
          image_url?: string | null
          international_students?: number | null
          map_embed_url?: string | null
          name_ar: string
          name_en?: string | null
          page_content?: string | null
          rich_content?: Json | null
          seo_canonical_url?: string | null
          seo_description?: string | null
          seo_h1?: string | null
          seo_index?: boolean | null
          seo_last_reviewed_at?: string | null
          seo_title?: string | null
          slug: string
        }
        Update: {
          country_code?: string
          currency_code?: string | null
          display_order?: number | null
          education_rank_global?: number | null
          id?: string
          image_url?: string | null
          international_students?: number | null
          map_embed_url?: string | null
          name_ar?: string
          name_en?: string | null
          page_content?: string | null
          rich_content?: Json | null
          seo_canonical_url?: string | null
          seo_description?: string | null
          seo_h1?: string | null
          seo_index?: boolean | null
          seo_last_reviewed_at?: string | null
          seo_title?: string | null
          slug?: string
        }
        Relationships: []
      }
      country_aliases: {
        Row: {
          alias_normalized: string
          country_id: string
          created_at: string
          id: string
          source: string | null
        }
        Insert: {
          alias_normalized: string
          country_id: string
          created_at?: string
          id?: string
          source?: string | null
        }
        Update: {
          alias_normalized?: string
          country_id?: string
          created_at?: string
          id?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "country_aliases_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "country_aliases_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_events_search"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "country_aliases_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "country_aliases_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "country_aliases_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "country_aliases_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_scholarship_search"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "country_aliases_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "country_aliases_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "country_aliases_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["country_id"]
          },
        ]
      }
      crawl_batch_universities: {
        Row: {
          batch_id: string
          university_id: string
        }
        Insert: {
          batch_id: string
          university_id: string
        }
        Update: {
          batch_id?: string
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crawl_batch_universities_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "crawl_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_batch_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "crawl_batch_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "crawl_batch_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_batch_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "crawl_batch_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "crawl_batch_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "crawl_batch_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "crawl_batch_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "crawl_batch_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_batch_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "crawl_batch_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "crawl_batch_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_batches: {
        Row: {
          country_code: string | null
          created_at: string | null
          error_log: Json | null
          finished_at: string | null
          id: string
          programs_auto_ready: number | null
          programs_deep_review: number | null
          programs_discovered: number | null
          programs_extracted: number | null
          programs_published: number | null
          programs_quick_review: number | null
          rank_end: number | null
          rank_start: number | null
          started_at: string | null
          status: string | null
          universities_count: number | null
        }
        Insert: {
          country_code?: string | null
          created_at?: string | null
          error_log?: Json | null
          finished_at?: string | null
          id?: string
          programs_auto_ready?: number | null
          programs_deep_review?: number | null
          programs_discovered?: number | null
          programs_extracted?: number | null
          programs_published?: number | null
          programs_quick_review?: number | null
          rank_end?: number | null
          rank_start?: number | null
          started_at?: string | null
          status?: string | null
          universities_count?: number | null
        }
        Update: {
          country_code?: string | null
          created_at?: string | null
          error_log?: Json | null
          finished_at?: string | null
          id?: string
          programs_auto_ready?: number | null
          programs_deep_review?: number | null
          programs_discovered?: number | null
          programs_extracted?: number | null
          programs_published?: number | null
          programs_quick_review?: number | null
          rank_end?: number | null
          rank_start?: number | null
          started_at?: string | null
          status?: string | null
          universities_count?: number | null
        }
        Relationships: []
      }
      crawl_domain_policies: {
        Row: {
          allowed_paths: string[] | null
          backoff_429_ms: number
          blocked_paths: string[] | null
          crawl_delay_seconds: number | null
          host: string
          last_429_at: string | null
          max_concurrency: number
          max_rps: number | null
          notes: string | null
          requires_render: boolean | null
          robots_fetched_at: string | null
          robots_respected: boolean | null
          robots_txt_cache: string | null
          updated_at: string | null
          user_agent: string | null
        }
        Insert: {
          allowed_paths?: string[] | null
          backoff_429_ms?: number
          blocked_paths?: string[] | null
          crawl_delay_seconds?: number | null
          host: string
          last_429_at?: string | null
          max_concurrency?: number
          max_rps?: number | null
          notes?: string | null
          requires_render?: boolean | null
          robots_fetched_at?: string | null
          robots_respected?: boolean | null
          robots_txt_cache?: string | null
          updated_at?: string | null
          user_agent?: string | null
        }
        Update: {
          allowed_paths?: string[] | null
          backoff_429_ms?: number
          blocked_paths?: string[] | null
          crawl_delay_seconds?: number | null
          host?: string
          last_429_at?: string | null
          max_concurrency?: number
          max_rps?: number | null
          notes?: string | null
          requires_render?: boolean | null
          robots_fetched_at?: string | null
          robots_respected?: boolean | null
          robots_txt_cache?: string | null
          updated_at?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      crawl_file_artifacts: {
        Row: {
          artifact_type: string
          created_at: string
          evidence_snippet: string | null
          fetched_at: string | null
          file_name: string | null
          file_size_bytes: number | null
          id: string
          job_id: string | null
          mime_type: string | null
          parse_error: string | null
          parse_status: string
          parsed_at: string | null
          parsed_language: string | null
          parsed_pages: number | null
          parsed_text: string | null
          parser_version: string | null
          program_id: string | null
          row_id: string | null
          source_page_title: string | null
          source_page_url: string | null
          source_url: string
          storage_bucket: string
          storage_path: string | null
          trace_id: string | null
          university_id: string
          updated_at: string
        }
        Insert: {
          artifact_type?: string
          created_at?: string
          evidence_snippet?: string | null
          fetched_at?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          id?: string
          job_id?: string | null
          mime_type?: string | null
          parse_error?: string | null
          parse_status?: string
          parsed_at?: string | null
          parsed_language?: string | null
          parsed_pages?: number | null
          parsed_text?: string | null
          parser_version?: string | null
          program_id?: string | null
          row_id?: string | null
          source_page_title?: string | null
          source_page_url?: string | null
          source_url: string
          storage_bucket?: string
          storage_path?: string | null
          trace_id?: string | null
          university_id: string
          updated_at?: string
        }
        Update: {
          artifact_type?: string
          created_at?: string
          evidence_snippet?: string | null
          fetched_at?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          id?: string
          job_id?: string | null
          mime_type?: string | null
          parse_error?: string | null
          parse_status?: string
          parsed_at?: string | null
          parsed_language?: string | null
          parsed_pages?: number | null
          parsed_text?: string | null
          parser_version?: string | null
          program_id?: string | null
          row_id?: string | null
          source_page_title?: string | null
          source_page_url?: string | null
          source_url?: string
          storage_bucket?: string
          storage_path?: string | null
          trace_id?: string | null
          university_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      crawl_raw_snapshots: {
        Row: {
          content_hash: string | null
          content_type: string | null
          fetch_method: string | null
          fetched_at: string | null
          id: string
          metadata: Json | null
          programme_url: string | null
          raw_html: string | null
          raw_markdown: string | null
          source: string
          source_url: string
        }
        Insert: {
          content_hash?: string | null
          content_type?: string | null
          fetch_method?: string | null
          fetched_at?: string | null
          id?: string
          metadata?: Json | null
          programme_url?: string | null
          raw_html?: string | null
          raw_markdown?: string | null
          source: string
          source_url: string
        }
        Update: {
          content_hash?: string | null
          content_type?: string | null
          fetch_method?: string | null
          fetched_at?: string | null
          id?: string
          metadata?: Json | null
          programme_url?: string | null
          raw_html?: string | null
          raw_markdown?: string | null
          source?: string
          source_url?: string
        }
        Relationships: []
      }
      crawl_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      csw_program_guidance: {
        Row: {
          created_at: string | null
          csw_recommended: boolean | null
          do_not_offer: boolean | null
          do_not_offer_reason: string | null
          objections_i18n: Json | null
          priority: number | null
          program_id: string
          reason_codes: string[] | null
          selling_points_i18n: Json | null
          staff_notes: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          csw_recommended?: boolean | null
          do_not_offer?: boolean | null
          do_not_offer_reason?: string | null
          objections_i18n?: Json | null
          priority?: number | null
          program_id: string
          reason_codes?: string[] | null
          selling_points_i18n?: Json | null
          staff_notes?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          csw_recommended?: boolean | null
          do_not_offer?: boolean | null
          do_not_offer_reason?: string | null
          objections_i18n?: Json | null
          priority?: number | null
          program_id?: string
          reason_codes?: string[] | null
          selling_points_i18n?: Json | null
          staff_notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "csw_program_guidance_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: true
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "csw_program_guidance_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: true
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "csw_program_guidance_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: true
            referencedRelation: "programs_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "csw_program_guidance_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: true
            referencedRelation: "vw_program_details"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "csw_program_guidance_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: true
            referencedRelation: "vw_program_search"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "csw_program_guidance_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: true
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "csw_program_guidance_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: true
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "csw_program_guidance_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: true
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["program_id"]
          },
        ]
      }
      csw_university_guidance: {
        Row: {
          created_at: string | null
          csw_star: boolean | null
          do_not_offer: boolean | null
          do_not_offer_reason: string | null
          internal_notes: string | null
          objections: string[] | null
          partner_tier: string | null
          pitch_public_i18n: Json | null
          pitch_staff_i18n: Json | null
          priority_score: number | null
          selling_points: string[] | null
          university_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          csw_star?: boolean | null
          do_not_offer?: boolean | null
          do_not_offer_reason?: string | null
          internal_notes?: string | null
          objections?: string[] | null
          partner_tier?: string | null
          pitch_public_i18n?: Json | null
          pitch_staff_i18n?: Json | null
          priority_score?: number | null
          selling_points?: string[] | null
          university_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          csw_star?: boolean | null
          do_not_offer?: boolean | null
          do_not_offer_reason?: string | null
          internal_notes?: string | null
          objections?: string[] | null
          partner_tier?: string | null
          pitch_public_i18n?: Json | null
          pitch_staff_i18n?: Json | null
          priority_score?: number | null
          selling_points?: string[] | null
          university_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "csw_university_guidance_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "csw_university_guidance_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "csw_university_guidance_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "csw_university_guidance_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "csw_university_guidance_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "csw_university_guidance_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "csw_university_guidance_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "csw_university_guidance_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "csw_university_guidance_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "csw_university_guidance_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "csw_university_guidance_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "csw_university_guidance_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_files: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          document_category: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          profile_id: string | null
          status: string | null
          storage_path: string
          uploaded_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          document_category?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          profile_id?: string | null
          status?: string | null
          storage_path: string
          uploaded_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          document_category?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          profile_id?: string | null
          status?: string | null
          storage_path?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_files_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      customer_service_selections: {
        Row: {
          auth_user_id: string
          country_code: string
          created_at: string | null
          id: string
          pay_plan: string | null
          pricing_snapshot: Json | null
          pricing_version: string | null
          selected_addons: string[] | null
          selected_package_id: string | null
          selected_services: string[] | null
          source: string | null
          state_rev: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          auth_user_id: string
          country_code: string
          created_at?: string | null
          id?: string
          pay_plan?: string | null
          pricing_snapshot?: Json | null
          pricing_version?: string | null
          selected_addons?: string[] | null
          selected_package_id?: string | null
          selected_services?: string[] | null
          source?: string | null
          state_rev?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          auth_user_id?: string
          country_code?: string
          created_at?: string | null
          id?: string
          pay_plan?: string | null
          pricing_snapshot?: Json | null
          pricing_version?: string | null
          selected_addons?: string[] | null
          selected_package_id?: string | null
          selected_services?: string[] | null
          source?: string | null
          state_rev?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      d4_target_fields: {
        Row: {
          created_at: string
          display_name_ar: string
          display_name_en: string
          field_name: string
          is_active: boolean
          max_attempts: number
          priority: number
          source_strategy: string
        }
        Insert: {
          created_at?: string
          display_name_ar: string
          display_name_en: string
          field_name: string
          is_active?: boolean
          max_attempts?: number
          priority?: number
          source_strategy?: string
        }
        Update: {
          created_at?: string
          display_name_ar?: string
          display_name_en?: string
          field_name?: string
          is_active?: boolean
          max_attempts?: number
          priority?: number
          source_strategy?: string
        }
        Relationships: []
      }
      data_quality_rules: {
        Row: {
          created_at: string | null
          enabled: boolean
          id: string
          rule_key: string
          rule_name: string
          rule_type: string
          threshold: number
          weight: number
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean
          id?: string
          rule_key: string
          rule_name: string
          rule_type: string
          threshold?: number
          weight?: number
        }
        Update: {
          created_at?: string | null
          enabled?: boolean
          id?: string
          rule_key?: string
          rule_name?: string
          rule_type?: string
          threshold?: number
          weight?: number
        }
        Relationships: []
      }
      data_quality_snapshots: {
        Row: {
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: number
          metrics: Json
          rules_failed: number
          rules_passed: number
          score: number
        }
        Insert: {
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: number
          metrics?: Json
          rules_failed?: number
          rules_passed?: number
          score: number
        }
        Update: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: number
          metrics?: Json
          rules_failed?: number
          rules_passed?: number
          score?: number
        }
        Relationships: []
      }
      degrees: {
        Row: {
          id: string
          name: string
          name_ar: string | null
          slug: string
        }
        Insert: {
          id?: string
          name: string
          name_ar?: string | null
          slug: string
        }
        Update: {
          id?: string
          name?: string
          name_ar?: string | null
          slug?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_user_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_user_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "dm_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplines: {
        Row: {
          aliases_ar: string[] | null
          aliases_en: string[] | null
          created_at: string | null
          id: string
          name_ar: string
          name_en: string
          slug: string
        }
        Insert: {
          aliases_ar?: string[] | null
          aliases_en?: string[] | null
          created_at?: string | null
          id?: string
          name_ar: string
          name_en: string
          slug: string
        }
        Update: {
          aliases_ar?: string[] | null
          aliases_en?: string[] | null
          created_at?: string | null
          id?: string
          name_ar?: string
          name_en?: string
          slug?: string
        }
        Relationships: []
      }
      dm_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          student_unread_count: number
          student_user_id: string
          teacher_unread_count: number
          teacher_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          student_unread_count?: number
          student_user_id: string
          teacher_unread_count?: number
          teacher_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          student_unread_count?: number
          student_user_id?: string
          teacher_unread_count?: number
          teacher_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      education_events: {
        Row: {
          city: string | null
          country_id: string | null
          created_at: string | null
          description: string | null
          end_at: string | null
          event_type: string | null
          id: string
          is_online: boolean | null
          organizer: string | null
          start_at: string
          title: string
          url: string | null
          venue_name: string | null
        }
        Insert: {
          city?: string | null
          country_id?: string | null
          created_at?: string | null
          description?: string | null
          end_at?: string | null
          event_type?: string | null
          id?: string
          is_online?: boolean | null
          organizer?: string | null
          start_at: string
          title: string
          url?: string | null
          venue_name?: string | null
        }
        Update: {
          city?: string | null
          country_id?: string | null
          created_at?: string | null
          description?: string | null
          end_at?: string | null
          event_type?: string | null
          id?: string
          is_online?: boolean | null
          organizer?: string | null
          start_at?: string
          title?: string
          url?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "education_events_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "education_events_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_events_search"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "education_events_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "education_events_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "education_events_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "education_events_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_scholarship_search"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "education_events_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "education_events_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "education_events_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["country_id"]
          },
        ]
      }
      email_otp_codes: {
        Row: {
          attempts: number | null
          code: string
          created_at: string | null
          email: string
          expires_at: string
          id: string
          user_id: string
        }
        Insert: {
          attempts?: number | null
          code: string
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          user_id: string
        }
        Update: {
          attempts?: number | null
          code?: string
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body: string
          created_at: string | null
          id: string
          is_active: boolean | null
          key: string
          name: string
          subject: string
          variables: string[] | null
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key: string
          name: string
          subject: string
          variables?: string[] | null
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key?: string
          name?: string
          subject?: string
          variables?: string[] | null
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      entity_enrichment_facts: {
        Row: {
          confidence: number | null
          created_at: string
          display_text: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["orx_entity_type"]
          evidence_id: string | null
          fact_key: string
          fact_type: string
          fact_value: Json
          first_seen_at: string
          id: string
          last_seen_at: string
          last_verified_at: string | null
          source_domain: string | null
          source_type: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["enrichment_fact_status"]
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          display_text?: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["orx_entity_type"]
          evidence_id?: string | null
          fact_key: string
          fact_type: string
          fact_value?: Json
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          last_verified_at?: string | null
          source_domain?: string | null
          source_type?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["enrichment_fact_status"]
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          display_text?: string | null
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["orx_entity_type"]
          evidence_id?: string | null
          fact_key?: string
          fact_type?: string
          fact_value?: Json
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          last_verified_at?: string | null
          source_domain?: string | null
          source_type?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["enrichment_fact_status"]
          updated_at?: string
        }
        Relationships: []
      }
      entity_translations: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          field_name: string
          id: string
          locale: string
          quality_tier: number
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_hash: string | null
          translated_text: string
          translation_source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          field_name: string
          id?: string
          locale: string
          quality_tier?: number
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_hash?: string | null
          translated_text: string
          translation_source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          field_name?: string
          id?: string
          locale?: string
          quality_tier?: number
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_hash?: string | null
          translated_text?: string
          translation_source?: string
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string | null
          environment: string | null
          hostname: string | null
          id: string
          is_admin: boolean | null
          is_staff: boolean | null
          is_test: boolean | null
          name: string
          properties: Json | null
          route: string | null
          session_id: string | null
          tab: string | null
          trace_tag: string | null
          traffic_class: string | null
          visitor_id: string | null
        }
        Insert: {
          created_at?: string | null
          environment?: string | null
          hostname?: string | null
          id?: string
          is_admin?: boolean | null
          is_staff?: boolean | null
          is_test?: boolean | null
          name: string
          properties?: Json | null
          route?: string | null
          session_id?: string | null
          tab?: string | null
          trace_tag?: string | null
          traffic_class?: string | null
          visitor_id?: string | null
        }
        Update: {
          created_at?: string | null
          environment?: string | null
          hostname?: string | null
          id?: string
          is_admin?: boolean | null
          is_staff?: boolean | null
          is_test?: boolean | null
          name?: string
          properties?: Json | null
          route?: string | null
          session_id?: string | null
          tab?: string | null
          trace_tag?: string | null
          traffic_class?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          enabled: boolean
          key: string
          payload: Json | null
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          key: string
          payload?: Json | null
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          key?: string
          payload?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      feature_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      footer_links: {
        Row: {
          group: string
          id: string
          is_active: boolean | null
          order: number | null
          text: string
          url: string
        }
        Insert: {
          group: string
          id?: string
          is_active?: boolean | null
          order?: number | null
          text: string
          url: string
        }
        Update: {
          group?: string
          id?: string
          is_active?: boolean | null
          order?: number | null
          text?: string
          url?: string
        }
        Relationships: []
      }
      fx_rates: {
        Row: {
          currency_code: string
          rate_to_usd: number
          updated_at: string
        }
        Insert: {
          currency_code: string
          rate_to_usd: number
          updated_at?: string
        }
        Update: {
          currency_code?: string
          rate_to_usd?: number
          updated_at?: string
        }
        Relationships: []
      }
      fx_rates_daily: {
        Row: {
          base: string
          captured_at: string | null
          quote: string
          rate: number
          rate_date: string
          source: string | null
        }
        Insert: {
          base?: string
          captured_at?: string | null
          quote: string
          rate: number
          rate_date: string
          source?: string | null
        }
        Update: {
          base?: string
          captured_at?: string | null
          quote?: string
          rate?: number
          rate_date?: string
          source?: string | null
        }
        Relationships: []
      }
      fx_rates_history: {
        Row: {
          as_of_date: string
          created_at: string
          currency_code: string
          rate_to_usd: number
          source: string | null
        }
        Insert: {
          as_of_date: string
          created_at?: string
          currency_code: string
          rate_to_usd: number
          source?: string | null
        }
        Update: {
          as_of_date?: string
          created_at?: string
          currency_code?: string
          rate_to_usd?: number
          source?: string | null
        }
        Relationships: []
      }
      geo_cache: {
        Row: {
          bbox: Json | null
          city_name: string | null
          confidence: number
          country_code: string | null
          country_name: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          last_resolved_at: string
          last_used_at: string
          lat: number
          lon: number
          normalized_query_key: string
          resolution_level: string
          source: string
          university_name: string | null
        }
        Insert: {
          bbox?: Json | null
          city_name?: string | null
          confidence?: number
          country_code?: string | null
          country_name?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          last_resolved_at?: string
          last_used_at?: string
          lat: number
          lon: number
          normalized_query_key: string
          resolution_level: string
          source: string
          university_name?: string | null
        }
        Update: {
          bbox?: Json | null
          city_name?: string | null
          confidence?: number
          country_code?: string | null
          country_name?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          last_resolved_at?: string
          last_used_at?: string
          lat?: number
          lon?: number
          normalized_query_key?: string
          resolution_level?: string
          source?: string
          university_name?: string | null
        }
        Relationships: []
      }
      geo_verification_decisions: {
        Row: {
          actor_id: string
          after_state: Json
          before_state: Json
          created_at: string
          decision_type: string
          id: string
          job_id: string | null
          reason: string | null
          target_housing_id: string | null
          target_row_id: string | null
          target_university_id: string
          trace_id: string | null
        }
        Insert: {
          actor_id: string
          after_state?: Json
          before_state?: Json
          created_at?: string
          decision_type: string
          id?: string
          job_id?: string | null
          reason?: string | null
          target_housing_id?: string | null
          target_row_id?: string | null
          target_university_id: string
          trace_id?: string | null
        }
        Update: {
          actor_id?: string
          after_state?: Json
          before_state?: Json
          created_at?: string
          decision_type?: string
          id?: string
          job_id?: string | null
          reason?: string | null
          target_housing_id?: string | null
          target_row_id?: string | null
          target_university_id?: string
          trace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "geo_verification_decisions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "geo_verification_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_verification_decisions_target_housing_id_fkey"
            columns: ["target_housing_id"]
            isOneToOne: false
            referencedRelation: "university_housing_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_verification_decisions_target_row_id_fkey"
            columns: ["target_row_id"]
            isOneToOne: false
            referencedRelation: "geo_verification_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_verification_decisions_target_university_id_fkey"
            columns: ["target_university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "geo_verification_decisions_target_university_id_fkey"
            columns: ["target_university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "geo_verification_decisions_target_university_id_fkey"
            columns: ["target_university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_verification_decisions_target_university_id_fkey"
            columns: ["target_university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "geo_verification_decisions_target_university_id_fkey"
            columns: ["target_university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "geo_verification_decisions_target_university_id_fkey"
            columns: ["target_university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "geo_verification_decisions_target_university_id_fkey"
            columns: ["target_university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "geo_verification_decisions_target_university_id_fkey"
            columns: ["target_university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "geo_verification_decisions_target_university_id_fkey"
            columns: ["target_university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_verification_decisions_target_university_id_fkey"
            columns: ["target_university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "geo_verification_decisions_target_university_id_fkey"
            columns: ["target_university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "geo_verification_decisions_target_university_id_fkey"
            columns: ["target_university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_verification_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          failed_count: number
          filters: Json | null
          flagged_count: number
          id: string
          metrics: Json | null
          processed_count: number
          started_at: string | null
          status: string
          total_count: number
          unverifiable_count: number
          verified_count: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          filters?: Json | null
          flagged_count?: number
          id?: string
          metrics?: Json | null
          processed_count?: number
          started_at?: string | null
          status?: string
          total_count?: number
          unverifiable_count?: number
          verified_count?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          filters?: Json | null
          flagged_count?: number
          id?: string
          metrics?: Json | null
          processed_count?: number
          started_at?: string | null
          status?: string
          total_count?: number
          unverifiable_count?: number
          verified_count?: number
        }
        Relationships: []
      }
      geo_verification_rows: {
        Row: {
          city_match: boolean | null
          confidence: number | null
          coordinates_match: boolean | null
          country_match: boolean | null
          created_at: string
          current_city: string | null
          current_country_code: string | null
          has_reference_city_coordinates: boolean | null
          id: string
          issues: string[]
          job_id: string
          lease_owner: string | null
          lock_expires_at: string | null
          locked_at: string | null
          processed_at: string | null
          raw_data: Json | null
          resolution_source: string | null
          resolved_address: string | null
          resolved_city: string | null
          resolved_country_code: string | null
          resolved_lat: number | null
          resolved_lon: number | null
          status: string
          trace_id: string | null
          university_id: string
          university_name: string | null
        }
        Insert: {
          city_match?: boolean | null
          confidence?: number | null
          coordinates_match?: boolean | null
          country_match?: boolean | null
          created_at?: string
          current_city?: string | null
          current_country_code?: string | null
          has_reference_city_coordinates?: boolean | null
          id?: string
          issues?: string[]
          job_id: string
          lease_owner?: string | null
          lock_expires_at?: string | null
          locked_at?: string | null
          processed_at?: string | null
          raw_data?: Json | null
          resolution_source?: string | null
          resolved_address?: string | null
          resolved_city?: string | null
          resolved_country_code?: string | null
          resolved_lat?: number | null
          resolved_lon?: number | null
          status?: string
          trace_id?: string | null
          university_id: string
          university_name?: string | null
        }
        Update: {
          city_match?: boolean | null
          confidence?: number | null
          coordinates_match?: boolean | null
          country_match?: boolean | null
          created_at?: string
          current_city?: string | null
          current_country_code?: string | null
          has_reference_city_coordinates?: boolean | null
          id?: string
          issues?: string[]
          job_id?: string
          lease_owner?: string | null
          lock_expires_at?: string | null
          locked_at?: string | null
          processed_at?: string | null
          raw_data?: Json | null
          resolution_source?: string | null
          resolved_address?: string | null
          resolved_city?: string | null
          resolved_country_code?: string | null
          resolved_lat?: number | null
          resolved_lon?: number | null
          status?: string
          trace_id?: string | null
          university_id?: string
          university_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "geo_verification_rows_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "geo_verification_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_verification_rows_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "geo_verification_rows_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "geo_verification_rows_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_verification_rows_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "geo_verification_rows_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "geo_verification_rows_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "geo_verification_rows_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "geo_verification_rows_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "geo_verification_rows_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_verification_rows_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "geo_verification_rows_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "geo_verification_rows_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      governed_field_edits: {
        Row: {
          applied_at: string | null
          entity_id: string
          entity_type: string
          field_name: string
          id: string
          old_value: Json | null
          proposed_value: Json
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_note: string | null
          status: string
          submitted_at: string
          submitted_by: string
          university_id: string
        }
        Insert: {
          applied_at?: string | null
          entity_id: string
          entity_type: string
          field_name: string
          id?: string
          old_value?: Json | null
          proposed_value: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          status?: string
          submitted_at?: string
          submitted_by: string
          university_id: string
        }
        Update: {
          applied_at?: string | null
          entity_id?: string
          entity_type?: string
          field_name?: string
          id?: string
          old_value?: Json | null
          proposed_value?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string
          university_id?: string
        }
        Relationships: []
      }
      gsc_snapshots: {
        Row: {
          captured_at: string | null
          clicks: number | null
          ctr: number | null
          id: number
          impressions: number | null
          position: number | null
          property: string
          top_pages: Json | null
          top_queries: Json | null
        }
        Insert: {
          captured_at?: string | null
          clicks?: number | null
          ctr?: number | null
          id?: number
          impressions?: number | null
          position?: number | null
          property: string
          top_pages?: Json | null
          top_queries?: Json | null
        }
        Update: {
          captured_at?: string | null
          clicks?: number | null
          ctr?: number | null
          id?: number
          impressions?: number | null
          position?: number | null
          property?: string
          top_pages?: Json | null
          top_queries?: Json | null
        }
        Relationships: []
      }
      harvest_jobs: {
        Row: {
          audience: string | null
          country_code: string | null
          created_at: string | null
          created_by: string | null
          degree_level: string | null
          finished_at: string | null
          id: number
          kind: string
          scheduled_for: string | null
          started_at: string | null
          status: string | null
          university_id: string | null
        }
        Insert: {
          audience?: string | null
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          degree_level?: string | null
          finished_at?: string | null
          id?: number
          kind: string
          scheduled_for?: string | null
          started_at?: string | null
          status?: string | null
          university_id?: string | null
        }
        Update: {
          audience?: string | null
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          degree_level?: string | null
          finished_at?: string | null
          id?: number
          kind?: string
          scheduled_for?: string | null
          started_at?: string | null
          status?: string | null
          university_id?: string | null
        }
        Relationships: []
      }
      harvest_logs: {
        Row: {
          created_at: string | null
          id: number
          level: string | null
          message: string
          meta: Json | null
          run_id: number | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          level?: string | null
          message: string
          meta?: Json | null
          run_id?: number | null
        }
        Update: {
          created_at?: string | null
          id?: number
          level?: string | null
          message?: string
          meta?: Json | null
          run_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "harvest_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "harvest_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      harvest_results: {
        Row: {
          academic_year_detected: string | null
          admissions_urls: string[] | null
          confidence: number | null
          created_at: string | null
          currency_detected: string | null
          domain: string | null
          fee_evidence: Json | null
          fee_urls: string[] | null
          has_official_fees: boolean | null
          id: number
          inserted_counts: Json | null
          job_id: number | null
          page_lang: string | null
          prompt_version: string | null
          reason: string | null
          request_id: string | null
          source_model: string | null
          source_provider: string | null
          university_name: string | null
          usage_tokens: Json | null
        }
        Insert: {
          academic_year_detected?: string | null
          admissions_urls?: string[] | null
          confidence?: number | null
          created_at?: string | null
          currency_detected?: string | null
          domain?: string | null
          fee_evidence?: Json | null
          fee_urls?: string[] | null
          has_official_fees?: boolean | null
          id?: number
          inserted_counts?: Json | null
          job_id?: number | null
          page_lang?: string | null
          prompt_version?: string | null
          reason?: string | null
          request_id?: string | null
          source_model?: string | null
          source_provider?: string | null
          university_name?: string | null
          usage_tokens?: Json | null
        }
        Update: {
          academic_year_detected?: string | null
          admissions_urls?: string[] | null
          confidence?: number | null
          created_at?: string | null
          currency_detected?: string | null
          domain?: string | null
          fee_evidence?: Json | null
          fee_urls?: string[] | null
          has_official_fees?: boolean | null
          id?: number
          inserted_counts?: Json | null
          job_id?: number | null
          page_lang?: string | null
          prompt_version?: string | null
          reason?: string | null
          request_id?: string | null
          source_model?: string | null
          source_provider?: string | null
          university_name?: string | null
          usage_tokens?: Json | null
        }
        Relationships: []
      }
      harvest_review_queue: {
        Row: {
          ai_concerns: string[] | null
          ai_confidence: number | null
          ai_reasons: string[] | null
          ai_recommendation: string | null
          ai_suggested_at: string | null
          auto_approved: boolean | null
          auto_approved_at: string | null
          auto_approved_log: string | null
          content_hash: string | null
          country_code: string
          created_at: string | null
          created_from: string | null
          double_checked_at: string | null
          double_score: number | null
          double_validated: boolean | null
          double_verdict: string | null
          has_admissions: boolean | null
          has_programs: boolean | null
          has_tuition: boolean | null
          id: number
          ingestion_id: string | null
          languages: string[] | null
          programs: Json | null
          prompt_sha256: string | null
          prompt_version: string | null
          rejection_reason: string | null
          request_id: string | null
          source_model: string | null
          source_provider: string | null
          tuition_range: string | null
          university_name: string
          usage_tokens: Json | null
          verified: boolean | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          ai_concerns?: string[] | null
          ai_confidence?: number | null
          ai_reasons?: string[] | null
          ai_recommendation?: string | null
          ai_suggested_at?: string | null
          auto_approved?: boolean | null
          auto_approved_at?: string | null
          auto_approved_log?: string | null
          content_hash?: string | null
          country_code: string
          created_at?: string | null
          created_from?: string | null
          double_checked_at?: string | null
          double_score?: number | null
          double_validated?: boolean | null
          double_verdict?: string | null
          has_admissions?: boolean | null
          has_programs?: boolean | null
          has_tuition?: boolean | null
          id?: never
          ingestion_id?: string | null
          languages?: string[] | null
          programs?: Json | null
          prompt_sha256?: string | null
          prompt_version?: string | null
          rejection_reason?: string | null
          request_id?: string | null
          source_model?: string | null
          source_provider?: string | null
          tuition_range?: string | null
          university_name: string
          usage_tokens?: Json | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          ai_concerns?: string[] | null
          ai_confidence?: number | null
          ai_reasons?: string[] | null
          ai_recommendation?: string | null
          ai_suggested_at?: string | null
          auto_approved?: boolean | null
          auto_approved_at?: string | null
          auto_approved_log?: string | null
          content_hash?: string | null
          country_code?: string
          created_at?: string | null
          created_from?: string | null
          double_checked_at?: string | null
          double_score?: number | null
          double_validated?: boolean | null
          double_verdict?: string | null
          has_admissions?: boolean | null
          has_programs?: boolean | null
          has_tuition?: boolean | null
          id?: never
          ingestion_id?: string | null
          languages?: string[] | null
          programs?: Json | null
          prompt_sha256?: string | null
          prompt_version?: string | null
          rejection_reason?: string | null
          request_id?: string | null
          source_model?: string | null
          source_provider?: string | null
          tuition_range?: string | null
          university_name?: string
          usage_tokens?: Json | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      harvest_runs: {
        Row: {
          changed: number | null
          errors: number | null
          finished_at: string | null
          id: number
          job_id: number | null
          nochange: number | null
          processed: number | null
          started_at: string | null
          state: string | null
        }
        Insert: {
          changed?: number | null
          errors?: number | null
          finished_at?: string | null
          id?: number
          job_id?: number | null
          nochange?: number | null
          processed?: number | null
          started_at?: string | null
          state?: string | null
        }
        Update: {
          changed?: number | null
          errors?: number | null
          finished_at?: string | null
          id?: number
          job_id?: number | null
          nochange?: number | null
          processed?: number | null
          started_at?: string | null
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "harvest_runs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "harvest_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "harvest_runs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "vw_harvest_job_summary"
            referencedColumns: ["job_id"]
          },
        ]
      }
      hmac_nonces: {
        Row: {
          created_at: string
          expires_at: string | null
          nonce: string
          request_id: string
          ts: string
          used_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          nonce: string
          request_id?: string
          ts?: string
          used_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          nonce?: string
          request_id?: string
          ts?: string
          used_at?: string
        }
        Relationships: []
      }
      home_icons: {
        Row: {
          action_type: string | null
          analytics_tag: string | null
          icon_key: string
          id: string
          is_active: boolean | null
          order: number | null
          route_path: string
          service_id: string | null
          title: string
        }
        Insert: {
          action_type?: string | null
          analytics_tag?: string | null
          icon_key: string
          id?: string
          is_active?: boolean | null
          order?: number | null
          route_path: string
          service_id?: string | null
          title: string
        }
        Update: {
          action_type?: string | null
          analytics_tag?: string | null
          icon_key?: string
          id?: string
          is_active?: boolean | null
          order?: number | null
          route_path?: string
          service_id?: string | null
          title?: string
        }
        Relationships: []
      }
      import_logs: {
        Row: {
          applied_at: string | null
          applied_rows: number
          created_at: string
          created_by: string | null
          entity_type: string
          error_details: Json | null
          filename: string
          id: string
          import_type: string
          invalid_rows: number
          skipped_rows: number
          status: string
          total_rows: number
          valid_rows: number
        }
        Insert: {
          applied_at?: string | null
          applied_rows?: number
          created_at?: string
          created_by?: string | null
          entity_type: string
          error_details?: Json | null
          filename: string
          id?: string
          import_type?: string
          invalid_rows?: number
          skipped_rows?: number
          status?: string
          total_rows?: number
          valid_rows?: number
        }
        Update: {
          applied_at?: string | null
          applied_rows?: number
          created_at?: string
          created_by?: string | null
          entity_type?: string
          error_details?: Json | null
          filename?: string
          id?: string
          import_type?: string
          invalid_rows?: number
          skipped_rows?: number
          status?: string
          total_rows?: number
          valid_rows?: number
        }
        Relationships: []
      }
      ingest_artifacts: {
        Row: {
          content: Json | null
          created_at: string | null
          id: number
          job_id: string
          kind: string
        }
        Insert: {
          content?: Json | null
          created_at?: string | null
          id?: number
          job_id: string
          kind: string
        }
        Update: {
          content?: Json | null
          created_at?: string | null
          id?: number
          job_id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingest_artifacts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ingest_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      ingest_errors: {
        Row: {
          batch_id: string | null
          content_hash: string | null
          created_at: string
          details: Json
          details_json: Json
          entity_hint: string
          fingerprint: string | null
          id: string
          job_id: string | null
          pipeline: string
          reason: string
          source_url: string | null
          stage: string
        }
        Insert: {
          batch_id?: string | null
          content_hash?: string | null
          created_at?: string
          details?: Json
          details_json?: Json
          entity_hint: string
          fingerprint?: string | null
          id?: string
          job_id?: string | null
          pipeline: string
          reason: string
          source_url?: string | null
          stage: string
        }
        Update: {
          batch_id?: string | null
          content_hash?: string | null
          created_at?: string
          details?: Json
          details_json?: Json
          entity_hint?: string
          fingerprint?: string | null
          id?: string
          job_id?: string | null
          pipeline?: string
          reason?: string
          source_url?: string | null
          stage?: string
        }
        Relationships: []
      }
      ingest_jobs: {
        Row: {
          created_at: string | null
          id: string
          mime_type: string | null
          source_file_path: string | null
          source_file_sha256: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          mime_type?: string | null
          source_file_path?: string | null
          source_file_sha256?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          mime_type?: string | null
          source_file_path?: string | null
          source_file_sha256?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ingestion_jobs: {
        Row: {
          attempts: number | null
          created_at: string | null
          id: string
          last_error: string | null
          next_attempt_at: string | null
          source_id: string | null
          status: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          id?: string
          last_error?: string | null
          next_attempt_at?: string | null
          source_id?: string | null
          status?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          id?: string
          last_error?: string | null
          next_attempt_at?: string | null
          source_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "ingestion_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_results: {
        Row: {
          ai_model: string | null
          confidence_score: number | null
          created_at: string | null
          extraction_method: string | null
          id: string
          job_id: string | null
          mapped: Json | null
          notes: string | null
          programs_data: Json | null
          raw: Json | null
          reviewed_at: string | null
          reviewer: string | null
          scholarships_data: Json | null
          status: string | null
          university_data: Json | null
          validation_errors: Json | null
          verified: boolean | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          ai_model?: string | null
          confidence_score?: number | null
          created_at?: string | null
          extraction_method?: string | null
          id?: string
          job_id?: string | null
          mapped?: Json | null
          notes?: string | null
          programs_data?: Json | null
          raw?: Json | null
          reviewed_at?: string | null
          reviewer?: string | null
          scholarships_data?: Json | null
          status?: string | null
          university_data?: Json | null
          validation_errors?: Json | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          ai_model?: string | null
          confidence_score?: number | null
          created_at?: string | null
          extraction_method?: string | null
          id?: string
          job_id?: string | null
          mapped?: Json | null
          notes?: string | null
          programs_data?: Json | null
          raw?: Json | null
          reviewed_at?: string | null
          reviewer?: string | null
          scholarships_data?: Json | null
          status?: string | null
          university_data?: Json | null
          validation_errors?: Json | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_results_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ingestion_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_source_templates: {
        Row: {
          created_at: string | null
          extraction_rules: Json | null
          id: string
          is_active: boolean | null
          name: string
          source_type: string
          url_pattern: string | null
        }
        Insert: {
          created_at?: string | null
          extraction_rules?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          source_type: string
          url_pattern?: string | null
        }
        Update: {
          created_at?: string | null
          extraction_rules?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          source_type?: string
          url_pattern?: string | null
        }
        Relationships: []
      }
      ingestion_sources: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          id: string
          last_scraped_at: string | null
          notes: string | null
          priority: number | null
          scrape_frequency: string | null
          source_type: string | null
          title: string
          url: string
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          last_scraped_at?: string | null
          notes?: string | null
          priority?: number | null
          scrape_frequency?: string | null
          source_type?: string | null
          title: string
          url: string
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          last_scraped_at?: string | null
          notes?: string | null
          priority?: number | null
          scrape_frequency?: string | null
          source_type?: string | null
          title?: string
          url?: string
        }
        Relationships: []
      }
      ingestions_pending: {
        Row: {
          confidence: number | null
          created_at: string | null
          id: string
          payload: Json
          source: string | null
          type: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          payload: Json
          source?: string | null
          type: string
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          payload?: Json
          source?: string | null
          type?: string
        }
        Relationships: []
      }
      institution_claims: {
        Row: {
          allowed_modules: Json | null
          city: string | null
          claim_type: string
          country: string | null
          created_at: string
          department: string | null
          evidence_paths: Json | null
          id: string
          institution_id: string | null
          institution_name: string
          job_title: string | null
          missing_items: Json | null
          notes: string | null
          official_email: string
          reviewer_notes: string | null
          role: string | null
          status: string
          submitted_at: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          allowed_modules?: Json | null
          city?: string | null
          claim_type?: string
          country?: string | null
          created_at?: string
          department?: string | null
          evidence_paths?: Json | null
          id?: string
          institution_id?: string | null
          institution_name: string
          job_title?: string | null
          missing_items?: Json | null
          notes?: string | null
          official_email: string
          reviewer_notes?: string | null
          role?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          allowed_modules?: Json | null
          city?: string | null
          claim_type?: string
          country?: string | null
          created_at?: string
          department?: string | null
          evidence_paths?: Json | null
          id?: string
          institution_id?: string | null
          institution_name?: string
          job_title?: string | null
          missing_items?: Json | null
          notes?: string | null
          official_email?: string
          reviewer_notes?: string | null
          role?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      institution_page_edits: {
        Row: {
          block_type: string
          created_at: string
          id: string
          payload: Json
          published_at: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          status: string
          submitted_by: string
          university_id: string
          updated_at: string
        }
        Insert: {
          block_type: string
          created_at?: string
          id?: string
          payload?: Json
          published_at?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
          submitted_by: string
          university_id: string
          updated_at?: string
        }
        Update: {
          block_type?: string
          created_at?: string
          id?: string
          payload?: Json
          published_at?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
          submitted_by?: string
          university_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      institution_rankings: {
        Row: {
          academic_reputation_score: number | null
          created_at: string
          data_source: string
          employability_score: number | null
          id: string
          institution_id: string
          is_mock: boolean
          is_primary: boolean | null
          national_rank: number | null
          overall_score: number | null
          ranking_system: string
          ranking_year: number
          research_score: number | null
          source_url: string | null
          teaching_score: number | null
          updated_at: string
          world_rank: number | null
        }
        Insert: {
          academic_reputation_score?: number | null
          created_at?: string
          data_source?: string
          employability_score?: number | null
          id?: string
          institution_id: string
          is_mock?: boolean
          is_primary?: boolean | null
          national_rank?: number | null
          overall_score?: number | null
          ranking_system: string
          ranking_year: number
          research_score?: number | null
          source_url?: string | null
          teaching_score?: number | null
          updated_at?: string
          world_rank?: number | null
        }
        Update: {
          academic_reputation_score?: number | null
          created_at?: string
          data_source?: string
          employability_score?: number | null
          id?: string
          institution_id?: string
          is_mock?: boolean
          is_primary?: boolean | null
          national_rank?: number | null
          overall_score?: number | null
          ranking_system?: string
          ranking_year?: number
          research_score?: number | null
          source_url?: string | null
          teaching_score?: number | null
          updated_at?: string
          world_rank?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "institution_rankings_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "institution_rankings_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "institution_rankings_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institution_rankings_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "institution_rankings_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "institution_rankings_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "institution_rankings_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "institution_rankings_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "institution_rankings_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institution_rankings_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "institution_rankings_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "institution_rankings_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_applications: {
        Row: {
          created_at: string
          file_quality_snapshot: Json
          id: string
          overall_score: number
          program_id: string
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          status: string
          submitted_at: string
          university_id: string
          updated_at: string
          user_id: string
          verdict: string
        }
        Insert: {
          created_at?: string
          file_quality_snapshot?: Json
          id?: string
          overall_score?: number
          program_id: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: string
          submitted_at?: string
          university_id: string
          updated_at?: string
          user_id: string
          verdict?: string
        }
        Update: {
          created_at?: string
          file_quality_snapshot?: Json
          id?: string
          overall_score?: number
          program_id?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: string
          submitted_at?: string
          university_id?: string
          updated_at?: string
          user_id?: string
          verdict?: string
        }
        Relationships: []
      }
      intake_doc_requests: {
        Row: {
          application_id: string
          comm_thread_id: string | null
          created_at: string
          doc_type: string
          fulfilled_at: string | null
          id: string
          message: string | null
          requested_by: string
          status: string
          updated_at: string
        }
        Insert: {
          application_id: string
          comm_thread_id?: string | null
          created_at?: string
          doc_type: string
          fulfilled_at?: string | null
          id?: string
          message?: string | null
          requested_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          comm_thread_id?: string | null
          created_at?: string
          doc_type?: string
          fulfilled_at?: string | null
          id?: string
          message?: string | null
          requested_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_doc_requests_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "intake_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_doc_requests_comm_thread_id_fkey"
            columns: ["comm_thread_id"]
            isOneToOne: false
            referencedRelation: "comm_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_reviewer_notes: {
        Row: {
          application_id: string
          author_id: string
          created_at: string
          id: string
          note: string
          visibility: string
        }
        Insert: {
          application_id: string
          author_id: string
          created_at?: string
          id?: string
          note: string
          visibility?: string
        }
        Update: {
          application_id?: string
          author_id?: string
          created_at?: string
          id?: string
          note?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_reviewer_notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "intake_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_status_history: {
        Row: {
          application_id: string
          changed_by: string
          created_at: string
          id: string
          new_status: string
          note: string | null
          old_status: string | null
        }
        Insert: {
          application_id: string
          changed_by: string
          created_at?: string
          id?: string
          new_status: string
          note?: string | null
          old_status?: string | null
        }
        Update: {
          application_id?: string
          changed_by?: string
          created_at?: string
          id?: string
          new_status?: string
          note?: string | null
          old_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intake_status_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "intake_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_alerts: {
        Row: {
          created_at: string
          id: number
          level: string
          message: string
        }
        Insert: {
          created_at?: string
          id?: never
          level: string
          message: string
        }
        Update: {
          created_at?: string
          id?: never
          level?: string
          message?: string
        }
        Relationships: []
      }
      integration_events: {
        Row: {
          created_at: string | null
          event_name: string
          id: string
          idempotency_key: string
          last_error: string | null
          payload: Json
          status: string | null
          target: string | null
        }
        Insert: {
          created_at?: string | null
          event_name: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          payload: Json
          status?: string | null
          target?: string | null
        }
        Update: {
          created_at?: string | null
          event_name?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          payload?: Json
          status?: string | null
          target?: string | null
        }
        Relationships: []
      }
      integration_outbox: {
        Row: {
          attempts: number
          created_at: string | null
          event_type: string
          id: number
          idempotency_key: string | null
          last_error: string | null
          next_attempt_at: string | null
          payload: Json
          status: string
          target: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string | null
          event_type: string
          id?: number
          idempotency_key?: string | null
          last_error?: string | null
          next_attempt_at?: string | null
          payload: Json
          status?: string
          target?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string | null
          event_type?: string
          id?: number
          idempotency_key?: string | null
          last_error?: string | null
          next_attempt_at?: string | null
          payload?: Json
          status?: string
          target?: string | null
        }
        Relationships: []
      }
      language_course_cohorts: {
        Row: {
          capacity: number | null
          created_at: string | null
          id: string
          language_key: string
          min_to_start: number | null
          product_id: string | null
          start_date: string
          status: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string | null
          id?: string
          language_key?: string
          min_to_start?: number | null
          product_id?: string | null
          start_date: string
          status?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string | null
          id?: string
          language_key?: string
          min_to_start?: number | null
          product_id?: string | null
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "language_course_cohorts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "language_course_products"
            referencedColumns: ["id"]
          },
        ]
      }
      language_course_enrollments: {
        Row: {
          activation_status: string
          admin_note: string | null
          approved_at: string | null
          approved_by: string | null
          cohort_id: string | null
          course_type: string
          created_at: string | null
          id: string
          language_key: string
          payment_method: string | null
          payment_proof_status: string
          price_usd: number
          product_id: string | null
          proof_uploaded_at: string | null
          proof_url: string | null
          rejected_at: string | null
          request_status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activation_status?: string
          admin_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          cohort_id?: string | null
          course_type: string
          created_at?: string | null
          id?: string
          language_key?: string
          payment_method?: string | null
          payment_proof_status?: string
          price_usd: number
          product_id?: string | null
          proof_uploaded_at?: string | null
          proof_url?: string | null
          rejected_at?: string | null
          request_status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activation_status?: string
          admin_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          cohort_id?: string | null
          course_type?: string
          created_at?: string | null
          id?: string
          language_key?: string
          payment_method?: string | null
          payment_proof_status?: string
          price_usd?: number
          product_id?: string | null
          proof_uploaded_at?: string | null
          proof_url?: string | null
          rejected_at?: string | null
          request_status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "language_course_enrollments_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "language_course_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "language_course_enrollments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "language_course_products"
            referencedColumns: ["id"]
          },
        ]
      }
      language_course_products: {
        Row: {
          course_type: string
          created_at: string | null
          description_ar: string | null
          description_en: string | null
          display_order: number | null
          duration_months: number | null
          features: Json | null
          id: string
          is_active: boolean | null
          language_key: string
          name_ar: string
          name_en: string
          price_usd: number
        }
        Insert: {
          course_type: string
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          display_order?: number | null
          duration_months?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          language_key?: string
          name_ar: string
          name_en: string
          price_usd: number
        }
        Update: {
          course_type?: string
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          display_order?: number | null
          duration_months?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          language_key?: string
          name_ar?: string
          name_en?: string
          price_usd?: number
        }
        Relationships: []
      }
      languages: {
        Row: {
          code: string
          created_at: string
          is_active: boolean
          name_ar: string
          name_en: string
        }
        Insert: {
          code: string
          created_at?: string
          is_active?: boolean
          name_ar: string
          name_en: string
        }
        Update: {
          code?: string
          created_at?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
        }
        Relationships: []
      }
      learning_assignments: {
        Row: {
          created_at: string | null
          description: string | null
          due_date: string | null
          enrollment_id: string | null
          feedback: string | null
          id: string
          instructions: string | null
          lesson_slug: string | null
          module_slug: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          score: number | null
          status: string
          submission_file_path: string | null
          submission_file_url: string | null
          submission_notes: string | null
          submission_text: string | null
          submitted_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          enrollment_id?: string | null
          feedback?: string | null
          id?: string
          instructions?: string | null
          lesson_slug?: string | null
          module_slug?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number | null
          status?: string
          submission_file_path?: string | null
          submission_file_url?: string | null
          submission_notes?: string | null
          submission_text?: string | null
          submitted_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          enrollment_id?: string | null
          feedback?: string | null
          id?: string
          instructions?: string | null
          lesson_slug?: string | null
          module_slug?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number | null
          status?: string
          submission_file_path?: string | null
          submission_file_url?: string | null
          submission_notes?: string | null
          submission_text?: string | null
          submitted_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_assignments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "learning_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_block_progress: {
        Row: {
          attempts: number
          block_id: string
          completed_at: string | null
          created_at: string | null
          id: string
          is_completed: boolean
          lesson_slug: string
          user_id: string
        }
        Insert: {
          attempts?: number
          block_id: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          is_completed?: boolean
          lesson_slug: string
          user_id: string
        }
        Update: {
          attempts?: number
          block_id?: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          is_completed?: boolean
          lesson_slug?: string
          user_id?: string
        }
        Relationships: []
      }
      learning_daily_streaks: {
        Row: {
          activity_date: string
          blocks_completed: number
          created_at: string | null
          id: string
          streak_count: number
          updated_at: string | null
          user_id: string
          words_mastered: number
        }
        Insert: {
          activity_date?: string
          blocks_completed?: number
          created_at?: string | null
          id?: string
          streak_count?: number
          updated_at?: string | null
          user_id: string
          words_mastered?: number
        }
        Update: {
          activity_date?: string
          blocks_completed?: number
          created_at?: string | null
          id?: string
          streak_count?: number
          updated_at?: string | null
          user_id?: string
          words_mastered?: number
        }
        Relationships: []
      }
      learning_enrollments: {
        Row: {
          academic_track: string | null
          daily_minutes: number | null
          enrollment_status: string
          goal: string | null
          id: string
          language: string
          level_mode: string | null
          path_key: string
          payment_status: string
          placement_result: string | null
          placement_score: number | null
          started_at: string | null
          timeline: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          academic_track?: string | null
          daily_minutes?: number | null
          enrollment_status?: string
          goal?: string | null
          id?: string
          language?: string
          level_mode?: string | null
          path_key?: string
          payment_status?: string
          placement_result?: string | null
          placement_score?: number | null
          started_at?: string | null
          timeline?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          academic_track?: string | null
          daily_minutes?: number | null
          enrollment_status?: string
          goal?: string | null
          id?: string
          language?: string
          level_mode?: string | null
          path_key?: string
          payment_status?: string
          placement_result?: string | null
          placement_score?: number | null
          started_at?: string | null
          timeline?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      learning_exam_notices: {
        Row: {
          created_at: string | null
          description: string | null
          enrollment_id: string | null
          exam_type: string
          external_link: string | null
          id: string
          module_coverage: string[] | null
          preparation_note: string | null
          scheduled_at: string | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          enrollment_id?: string | null
          exam_type?: string
          external_link?: string | null
          id?: string
          module_coverage?: string[] | null
          preparation_note?: string | null
          scheduled_at?: string | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          enrollment_id?: string | null
          exam_type?: string
          external_link?: string | null
          id?: string
          module_coverage?: string[] | null
          preparation_note?: string | null
          scheduled_at?: string | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_exam_notices_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "learning_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_lesson_progress: {
        Row: {
          completed_at: string | null
          created_at: string | null
          enrollment_id: string | null
          id: string
          lesson_slug: string
          module_slug: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          enrollment_id?: string | null
          id?: string
          lesson_slug: string
          module_slug: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          enrollment_id?: string | null
          id?: string
          lesson_slug?: string
          module_slug?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_lesson_progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "learning_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_placement_results: {
        Row: {
          answers: Json | null
          completed_at: string | null
          id: string
          language: string
          result_category: string
          score: number | null
          total_questions: number | null
          user_id: string
        }
        Insert: {
          answers?: Json | null
          completed_at?: string | null
          id?: string
          language?: string
          result_category: string
          score?: number | null
          total_questions?: number | null
          user_id: string
        }
        Update: {
          answers?: Json | null
          completed_at?: string | null
          id?: string
          language?: string
          result_category?: string
          score?: number | null
          total_questions?: number | null
          user_id?: string
        }
        Relationships: []
      }
      learning_study_sessions: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          enrollment_id: string | null
          event_type: string
          id: string
          lesson_slug: string | null
          module_slug: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          enrollment_id?: string | null
          event_type: string
          id?: string
          lesson_slug?: string | null
          module_slug?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          enrollment_id?: string | null
          event_type?: string
          id?: string
          lesson_slug?: string | null
          module_slug?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_study_sessions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "learning_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_vocab_progress: {
        Row: {
          created_at: string | null
          id: string
          last_reviewed_at: string | null
          lesson_slug: string | null
          mastery: string
          module_slug: string | null
          review_count: number | null
          transliteration: string | null
          user_id: string
          word_meaning: string
          word_ru: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_reviewed_at?: string | null
          lesson_slug?: string | null
          mastery?: string
          module_slug?: string | null
          review_count?: number | null
          transliteration?: string | null
          user_id: string
          word_meaning: string
          word_ru: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_reviewed_at?: string | null
          lesson_slug?: string | null
          mastery?: string
          module_slug?: string | null
          review_count?: number | null
          transliteration?: string | null
          user_id?: string
          word_meaning?: string
          word_ru?: string
        }
        Relationships: []
      }
      moderation_queue: {
        Row: {
          decided_at: string | null
          id: string
          pending_id: string | null
          reason: string | null
          reviewer_id: string | null
          status: string | null
        }
        Insert: {
          decided_at?: string | null
          id?: string
          pending_id?: string | null
          reason?: string | null
          reviewer_id?: string | null
          status?: string | null
        }
        Update: {
          decided_at?: string | null
          id?: string
          pending_id?: string | null
          reason?: string | null
          reviewer_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_queue_pending_id_fkey"
            columns: ["pending_id"]
            isOneToOne: false
            referencedRelation: "ingestions_pending"
            referencedColumns: ["id"]
          },
        ]
      }
      notarized_ledger: {
        Row: {
          amount_minor: number
          created_at: string
          credit_account: string | null
          currency: string
          debit_account: string | null
          description: string | null
          entry_type: string
          id: string
          meta: Json | null
          order_id: string | null
          payment_id: string | null
          quote_id: string | null
        }
        Insert: {
          amount_minor: number
          created_at?: string
          credit_account?: string | null
          currency?: string
          debit_account?: string | null
          description?: string | null
          entry_type: string
          id?: string
          meta?: Json | null
          order_id?: string | null
          payment_id?: string | null
          quote_id?: string | null
        }
        Update: {
          amount_minor?: number
          created_at?: string
          credit_account?: string | null
          currency?: string
          debit_account?: string | null
          description?: string | null
          entry_type?: string
          id?: string
          meta?: Json | null
          order_id?: string | null
          payment_id?: string | null
          quote_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notarized_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "notarized_translation_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notarized_ledger_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "notarized_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notarized_ledger_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "notarized_translation_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      notarized_payment_provider_events: {
        Row: {
          event_type: string
          id: string
          payment_id: string | null
          processed_at: string
          provider: string
          provider_event_id: string
          raw_payload: Json | null
        }
        Insert: {
          event_type: string
          id?: string
          payment_id?: string | null
          processed_at?: string
          provider: string
          provider_event_id: string
          raw_payload?: Json | null
        }
        Update: {
          event_type?: string
          id?: string
          payment_id?: string | null
          processed_at?: string
          provider?: string
          provider_event_id?: string
          raw_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "notarized_payment_provider_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "notarized_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      notarized_payments: {
        Row: {
          amount_major: number | null
          amount_minor: number
          created_at: string
          currency: string
          id: string
          idempotency_key: string | null
          order_id: string
          paid_at: string | null
          provider: string
          provider_payment_id: string | null
          provider_session_id: string | null
          quote_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_major?: number | null
          amount_minor: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string | null
          order_id: string
          paid_at?: string | null
          provider?: string
          provider_payment_id?: string | null
          provider_session_id?: string | null
          quote_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_major?: number | null
          amount_minor?: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string | null
          order_id?: string
          paid_at?: string | null
          provider?: string
          provider_payment_id?: string | null
          provider_session_id?: string | null
          quote_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notarized_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "notarized_translation_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notarized_payments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "notarized_translation_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      notarized_pricing_rules: {
        Row: {
          base_price_minor: number
          country_code: string
          created_at: string
          currency: string
          doc_slot: string
          effective_from: string
          extra_page_price_minor: number
          id: number
          is_active: boolean
          vat_rate: number
        }
        Insert: {
          base_price_minor: number
          country_code?: string
          created_at?: string
          currency?: string
          doc_slot: string
          effective_from?: string
          extra_page_price_minor: number
          id?: number
          is_active?: boolean
          vat_rate?: number
        }
        Update: {
          base_price_minor?: number
          country_code?: string
          created_at?: string
          currency?: string
          doc_slot?: string
          effective_from?: string
          extra_page_price_minor?: number
          id?: number
          is_active?: boolean
          vat_rate?: number
        }
        Relationships: []
      }
      notarized_translation_events: {
        Row: {
          actor_id: string | null
          actor_type: string | null
          created_at: string
          event_type: string
          id: string
          job_id: string | null
          meta: Json | null
          new_status: string | null
          old_status: string | null
          order_id: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string | null
          created_at?: string
          event_type: string
          id?: string
          job_id?: string | null
          meta?: Json | null
          new_status?: string | null
          old_status?: string | null
          order_id?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_type?: string | null
          created_at?: string
          event_type?: string
          id?: string
          job_id?: string | null
          meta?: Json | null
          new_status?: string | null
          old_status?: string | null
          order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notarized_translation_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "notarized_translation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notarized_translation_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "notarized_translation_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notarized_translation_jobs: {
        Row: {
          created_at: string
          doc_slot: string
          doc_type_confidence: number | null
          doc_type_guess: string | null
          draft_docx_path: string | null
          draft_pdf_path: string | null
          error_message: string | null
          extracted_json_path: string | null
          fix_tips: string[] | null
          id: string
          order_id: string
          original_meta: Json | null
          original_path: string | null
          page_count: number | null
          page_count_locked: boolean
          page_count_locked_at: string | null
          processing_meta: Json | null
          quality_flags: string[] | null
          quality_score: number | null
          rejection_code: string | null
          rejection_reasons: string[] | null
          scan_pdf_path: string | null
          status: string
          template_id: string | null
          template_version: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          doc_slot: string
          doc_type_confidence?: number | null
          doc_type_guess?: string | null
          draft_docx_path?: string | null
          draft_pdf_path?: string | null
          error_message?: string | null
          extracted_json_path?: string | null
          fix_tips?: string[] | null
          id?: string
          order_id: string
          original_meta?: Json | null
          original_path?: string | null
          page_count?: number | null
          page_count_locked?: boolean
          page_count_locked_at?: string | null
          processing_meta?: Json | null
          quality_flags?: string[] | null
          quality_score?: number | null
          rejection_code?: string | null
          rejection_reasons?: string[] | null
          scan_pdf_path?: string | null
          status?: string
          template_id?: string | null
          template_version?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          doc_slot?: string
          doc_type_confidence?: number | null
          doc_type_guess?: string | null
          draft_docx_path?: string | null
          draft_pdf_path?: string | null
          error_message?: string | null
          extracted_json_path?: string | null
          fix_tips?: string[] | null
          id?: string
          order_id?: string
          original_meta?: Json | null
          original_path?: string | null
          page_count?: number | null
          page_count_locked?: boolean
          page_count_locked_at?: string | null
          processing_meta?: Json | null
          quality_flags?: string[] | null
          quality_score?: number | null
          rejection_code?: string | null
          rejection_reasons?: string[] | null
          scan_pdf_path?: string | null
          status?: string
          template_id?: string | null
          template_version?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notarized_translation_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "notarized_translation_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notarized_translation_notifications: {
        Row: {
          channel: string
          created_at: string
          error: string | null
          id: string
          job_id: string | null
          order_id: string | null
          payload: Json | null
          recipient: string
          sent_at: string | null
          status: string | null
          template_key: string
        }
        Insert: {
          channel: string
          created_at?: string
          error?: string | null
          id?: string
          job_id?: string | null
          order_id?: string | null
          payload?: Json | null
          recipient: string
          sent_at?: string | null
          status?: string | null
          template_key: string
        }
        Update: {
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          job_id?: string | null
          order_id?: string | null
          payload?: Json | null
          recipient?: string
          sent_at?: string | null
          status?: string | null
          template_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "notarized_translation_notifications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "notarized_translation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notarized_translation_notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "notarized_translation_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notarized_translation_orders: {
        Row: {
          created_at: string
          currency: string | null
          customer_id: string | null
          delivery_address: Json | null
          delivery_destination: string | null
          delivery_mode: string
          doc_slots: string[]
          estimated_completion_at: string | null
          id: string
          notes: string | null
          notification_channels: string[] | null
          notify_channels: string[] | null
          payment_ref: string | null
          price_cents: number | null
          retention_expires_at: string | null
          status: string
          updated_at: string
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string | null
          customer_id?: string | null
          delivery_address?: Json | null
          delivery_destination?: string | null
          delivery_mode?: string
          doc_slots?: string[]
          estimated_completion_at?: string | null
          id?: string
          notes?: string | null
          notification_channels?: string[] | null
          notify_channels?: string[] | null
          payment_ref?: string | null
          price_cents?: number | null
          retention_expires_at?: string | null
          status?: string
          updated_at?: string
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string | null
          customer_id?: string | null
          delivery_address?: Json | null
          delivery_destination?: string | null
          delivery_mode?: string
          doc_slots?: string[]
          estimated_completion_at?: string | null
          id?: string
          notes?: string | null
          notification_channels?: string[] | null
          notify_channels?: string[] | null
          payment_ref?: string | null
          price_cents?: number | null
          retention_expires_at?: string | null
          status?: string
          updated_at?: string
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notarized_translation_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notarized_translation_queue: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string
          id: string
          job_id: string
          last_error: string | null
          lock_ttl_seconds: number | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number | null
          next_attempt_at: string | null
          priority: number | null
          stage: string
          status: string
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          id?: string
          job_id: string
          last_error?: string | null
          lock_ttl_seconds?: number | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number | null
          next_attempt_at?: string | null
          priority?: number | null
          stage?: string
          status?: string
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          id?: string
          job_id?: string
          last_error?: string | null
          lock_ttl_seconds?: number | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number | null
          next_attempt_at?: string | null
          priority?: number | null
          stage?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notarized_translation_queue_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "notarized_translation_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      notarized_translation_quotes: {
        Row: {
          accepted_at: string | null
          breakdown_json: Json
          created_at: string
          currency: string
          expires_at: string
          id: string
          order_id: string
          pricing_snapshot_json: Json | null
          schema_version: number
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          breakdown_json?: Json
          created_at?: string
          currency?: string
          expires_at?: string
          id?: string
          order_id: string
          pricing_snapshot_json?: Json | null
          schema_version?: number
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          breakdown_json?: Json
          created_at?: string
          currency?: string
          expires_at?: string
          id?: string
          order_id?: string
          pricing_snapshot_json?: Json | null
          schema_version?: number
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notarized_translation_quotes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "notarized_translation_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notarized_translation_templates: {
        Row: {
          created_at: string
          doc_slot: string
          id: string
          is_active: boolean | null
          master_docx_path: string | null
          metadata_json_path: string | null
          outputs: string[] | null
          placeholders: Json | null
          template_id: string
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          doc_slot: string
          id?: string
          is_active?: boolean | null
          master_docx_path?: string | null
          metadata_json_path?: string | null
          outputs?: string[] | null
          placeholders?: Json | null
          template_id: string
          updated_at?: string
          version?: string
        }
        Update: {
          created_at?: string
          doc_slot?: string
          id?: string
          is_active?: boolean | null
          master_docx_path?: string | null
          metadata_json_path?: string | null
          outputs?: string[] | null
          placeholders?: Json | null
          template_id?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          application_id: string | null
          channel: string
          created_at: string
          id: string
          last_error: string | null
          payload: Json | null
          sent_at: string | null
          status: string
          subject: string | null
          template_key: string
          visitor_id: string | null
        }
        Insert: {
          application_id?: string | null
          channel: string
          created_at?: string
          id?: string
          last_error?: string | null
          payload?: Json | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_key: string
          visitor_id?: string | null
        }
        Update: {
          application_id?: string | null
          channel?: string
          created_at?: string
          id?: string
          last_error?: string | null
          payload?: Json | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_key?: string
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      official_site_crawl_jobs: {
        Row: {
          completed_at: string | null
          country_codes: string[] | null
          crawled: number
          created_at: string
          failed: number
          id: string
          kill_switch: boolean
          max_pages_per_uni: number | null
          max_universities: number | null
          mode: string
          phase: string
          published: number
          quarantined: number
          rank_from: number | null
          rank_to: number | null
          requested_by: string | null
          source_policy: string | null
          special_queue: number
          started_at: string | null
          stats_json: Json | null
          status: string
          total_universities: number
          trace_id: string | null
          updated_at: string
          verified: number
        }
        Insert: {
          completed_at?: string | null
          country_codes?: string[] | null
          crawled?: number
          created_at?: string
          failed?: number
          id?: string
          kill_switch?: boolean
          max_pages_per_uni?: number | null
          max_universities?: number | null
          mode?: string
          phase?: string
          published?: number
          quarantined?: number
          rank_from?: number | null
          rank_to?: number | null
          requested_by?: string | null
          source_policy?: string | null
          special_queue?: number
          started_at?: string | null
          stats_json?: Json | null
          status?: string
          total_universities?: number
          trace_id?: string | null
          updated_at?: string
          verified?: number
        }
        Update: {
          completed_at?: string | null
          country_codes?: string[] | null
          crawled?: number
          created_at?: string
          failed?: number
          id?: string
          kill_switch?: boolean
          max_pages_per_uni?: number | null
          max_universities?: number | null
          mode?: string
          phase?: string
          published?: number
          quarantined?: number
          rank_from?: number | null
          rank_to?: number | null
          requested_by?: string | null
          source_policy?: string | null
          special_queue?: number
          started_at?: string | null
          stats_json?: Json | null
          status?: string
          total_universities?: number
          trace_id?: string | null
          updated_at?: string
          verified?: number
        }
        Relationships: []
      }
      official_site_crawl_rows: {
        Row: {
          artifacts_path: string | null
          completeness_by_section: Json | null
          completeness_score: number | null
          country_code: string | null
          coverage_plan: Json | null
          coverage_result: Json | null
          crawl_status: string
          crawl_strategy: string | null
          created_at: string
          discovery_passes: Json | null
          error_message: string | null
          extracted_summary: Json | null
          id: string
          job_id: string
          locked_at: string | null
          locked_by: string | null
          pages_mapped: number | null
          pages_scraped: number | null
          reason_codes: string[] | null
          university_id: string
          university_name: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          artifacts_path?: string | null
          completeness_by_section?: Json | null
          completeness_score?: number | null
          country_code?: string | null
          coverage_plan?: Json | null
          coverage_result?: Json | null
          crawl_status?: string
          crawl_strategy?: string | null
          created_at?: string
          discovery_passes?: Json | null
          error_message?: string | null
          extracted_summary?: Json | null
          id?: string
          job_id: string
          locked_at?: string | null
          locked_by?: string | null
          pages_mapped?: number | null
          pages_scraped?: number | null
          reason_codes?: string[] | null
          university_id: string
          university_name?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          artifacts_path?: string | null
          completeness_by_section?: Json | null
          completeness_score?: number | null
          country_code?: string | null
          coverage_plan?: Json | null
          coverage_result?: Json | null
          crawl_status?: string
          crawl_strategy?: string | null
          created_at?: string
          discovery_passes?: Json | null
          error_message?: string | null
          extracted_summary?: Json | null
          id?: string
          job_id?: string
          locked_at?: string | null
          locked_by?: string | null
          pages_mapped?: number | null
          pages_scraped?: number | null
          reason_codes?: string[] | null
          university_id?: string
          university_name?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "official_site_crawl_rows_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "official_site_crawl_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      official_site_observations: {
        Row: {
          billing_period: string | null
          confidence: number | null
          created_at: string
          currency: string | null
          cycle_detected: string | null
          entity_id: string | null
          entity_type: string
          evidence_snippet: string | null
          extracted_at: string | null
          fact_group: string | null
          fetched_at: string | null
          field_name: string
          id: string
          job_id: string | null
          page_title: string | null
          parser_version: string | null
          reason_code: string | null
          row_id: string | null
          source_tier: string | null
          source_type: string | null
          source_url: string | null
          status: string
          trace_id: string | null
          university_id: string
          value_normalized: string | null
          value_raw: string | null
          verify_tier: string | null
        }
        Insert: {
          billing_period?: string | null
          confidence?: number | null
          created_at?: string
          currency?: string | null
          cycle_detected?: string | null
          entity_id?: string | null
          entity_type?: string
          evidence_snippet?: string | null
          extracted_at?: string | null
          fact_group?: string | null
          fetched_at?: string | null
          field_name: string
          id?: string
          job_id?: string | null
          page_title?: string | null
          parser_version?: string | null
          reason_code?: string | null
          row_id?: string | null
          source_tier?: string | null
          source_type?: string | null
          source_url?: string | null
          status?: string
          trace_id?: string | null
          university_id: string
          value_normalized?: string | null
          value_raw?: string | null
          verify_tier?: string | null
        }
        Update: {
          billing_period?: string | null
          confidence?: number | null
          created_at?: string
          currency?: string | null
          cycle_detected?: string | null
          entity_id?: string | null
          entity_type?: string
          evidence_snippet?: string | null
          extracted_at?: string | null
          fact_group?: string | null
          fetched_at?: string | null
          field_name?: string
          id?: string
          job_id?: string | null
          page_title?: string | null
          parser_version?: string | null
          reason_code?: string | null
          row_id?: string | null
          source_tier?: string | null
          source_type?: string | null
          source_url?: string | null
          status?: string
          trace_id?: string | null
          university_id?: string
          value_normalized?: string | null
          value_raw?: string | null
          verify_tier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "official_site_observations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "official_site_crawl_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "official_site_observations_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "official_site_crawl_rows"
            referencedColumns: ["id"]
          },
        ]
      }
      official_site_publish_batches: {
        Row: {
          applied_items: number
          batch_type: string
          completed_at: string | null
          created_at: string
          failed_items: number
          id: string
          job_id: string | null
          requested_by: string | null
          skipped_items: number
          status: string
          total_items: number
        }
        Insert: {
          applied_items?: number
          batch_type?: string
          completed_at?: string | null
          created_at?: string
          failed_items?: number
          id?: string
          job_id?: string | null
          requested_by?: string | null
          skipped_items?: number
          status?: string
          total_items?: number
        }
        Update: {
          applied_items?: number
          batch_type?: string
          completed_at?: string | null
          created_at?: string
          failed_items?: number
          id?: string
          job_id?: string | null
          requested_by?: string | null
          skipped_items?: number
          status?: string
          total_items?: number
        }
        Relationships: [
          {
            foreignKeyName: "official_site_publish_batches_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "official_site_crawl_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      official_site_special_queue: {
        Row: {
          attempts: number | null
          created_at: string
          id: string
          last_error: string | null
          priority: number | null
          reason_code: string
          retry_after: string | null
          status: string
          strategy_needed: string | null
          university_id: string
          university_name: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string
          id?: string
          last_error?: string | null
          priority?: number | null
          reason_code: string
          retry_after?: string | null
          status?: string
          strategy_needed?: string | null
          university_id: string
          university_name?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string
          id?: string
          last_error?: string | null
          priority?: number | null
          reason_code?: string
          retry_after?: string | null
          status?: string
          strategy_needed?: string | null
          university_id?: string
          university_name?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      orx_crawl_audit: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          entity_id: string | null
          id: string
          job_id: string | null
          payload: Json | null
          reason: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          job_id?: string | null
          payload?: Json | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          job_id?: string | null
          payload?: Json | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orx_crawl_audit_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "orx_crawl_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      orx_crawl_jobs: {
        Row: {
          created_at: string
          current_stage: string | null
          entity_id: string
          entity_type: string
          evidence_created: number
          facts_created: number
          finished_at: string | null
          id: string
          job_type: string
          last_error: string | null
          last_heartbeat_at: string | null
          pages_discovered: number
          pages_fetched: number
          pages_processed: number
          pages_total_estimate: number | null
          retry_count: number
          score_updated: boolean
          started_at: string | null
          status: string
          triggered_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_stage?: string | null
          entity_id: string
          entity_type: string
          evidence_created?: number
          facts_created?: number
          finished_at?: string | null
          id?: string
          job_type?: string
          last_error?: string | null
          last_heartbeat_at?: string | null
          pages_discovered?: number
          pages_fetched?: number
          pages_processed?: number
          pages_total_estimate?: number | null
          retry_count?: number
          score_updated?: boolean
          started_at?: string | null
          status?: string
          triggered_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_stage?: string | null
          entity_id?: string
          entity_type?: string
          evidence_created?: number
          facts_created?: number
          finished_at?: string | null
          id?: string
          job_type?: string
          last_error?: string | null
          last_heartbeat_at?: string | null
          pages_discovered?: number
          pages_fetched?: number
          pages_processed?: number
          pages_total_estimate?: number | null
          retry_count?: number
          score_updated?: boolean
          started_at?: string | null
          status?: string
          triggered_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      orx_dimension_facts: {
        Row: {
          boundary_type: Database["public"]["Enums"]["orx_fact_boundary"]
          comparability_score: number | null
          confidence: number | null
          coverage_score: number | null
          created_at: string
          dimension_domain: Database["public"]["Enums"]["orx_dimension_domain"]
          display_text: string | null
          entity_id: string
          entity_type: string
          fact_family: string
          fact_key: string
          fact_value: Json
          first_seen_at: string
          freshness_date: string | null
          id: string
          last_seen_at: string
          last_verified_at: string | null
          methodology_version: string
          regional_bias_flag: boolean
          source_domain: string | null
          source_family: string
          source_type: string | null
          source_url: string | null
          sparsity_flag: boolean
          status: Database["public"]["Enums"]["orx_dimension_fact_status"]
          updated_at: string
        }
        Insert: {
          boundary_type: Database["public"]["Enums"]["orx_fact_boundary"]
          comparability_score?: number | null
          confidence?: number | null
          coverage_score?: number | null
          created_at?: string
          dimension_domain: Database["public"]["Enums"]["orx_dimension_domain"]
          display_text?: string | null
          entity_id: string
          entity_type: string
          fact_family: string
          fact_key: string
          fact_value?: Json
          first_seen_at?: string
          freshness_date?: string | null
          id?: string
          last_seen_at?: string
          last_verified_at?: string | null
          methodology_version?: string
          regional_bias_flag?: boolean
          source_domain?: string | null
          source_family: string
          source_type?: string | null
          source_url?: string | null
          sparsity_flag?: boolean
          status?: Database["public"]["Enums"]["orx_dimension_fact_status"]
          updated_at?: string
        }
        Update: {
          boundary_type?: Database["public"]["Enums"]["orx_fact_boundary"]
          comparability_score?: number | null
          confidence?: number | null
          coverage_score?: number | null
          created_at?: string
          dimension_domain?: Database["public"]["Enums"]["orx_dimension_domain"]
          display_text?: string | null
          entity_id?: string
          entity_type?: string
          fact_family?: string
          fact_key?: string
          fact_value?: Json
          first_seen_at?: string
          freshness_date?: string | null
          id?: string
          last_seen_at?: string
          last_verified_at?: string | null
          methodology_version?: string
          regional_bias_flag?: boolean
          source_domain?: string | null
          source_family?: string
          source_type?: string | null
          source_url?: string | null
          sparsity_flag?: boolean
          status?: Database["public"]["Enums"]["orx_dimension_fact_status"]
          updated_at?: string
        }
        Relationships: []
      }
      orx_evidence: {
        Row: {
          conflict_group_id: string | null
          content_hash: string
          contextual_only: boolean
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["orx_entity_type"]
          evidence_status: Database["public"]["Enums"]["orx_evidence_status"]
          extraction_confidence: number | null
          freshness_date: string | null
          id: string
          language_code: string | null
          layer: string
          methodology_version: string
          observed_at: string
          rejection_reason: string | null
          signal_family: string
          snippet: string | null
          source_domain: string
          source_title: string | null
          source_type: Database["public"]["Enums"]["orx_source_type"]
          source_url: string
          trust_level: Database["public"]["Enums"]["orx_trust_level"]
          updated_at: string
        }
        Insert: {
          conflict_group_id?: string | null
          content_hash: string
          contextual_only?: boolean
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["orx_entity_type"]
          evidence_status?: Database["public"]["Enums"]["orx_evidence_status"]
          extraction_confidence?: number | null
          freshness_date?: string | null
          id?: string
          language_code?: string | null
          layer: string
          methodology_version?: string
          observed_at?: string
          rejection_reason?: string | null
          signal_family: string
          snippet?: string | null
          source_domain: string
          source_title?: string | null
          source_type: Database["public"]["Enums"]["orx_source_type"]
          source_url: string
          trust_level?: Database["public"]["Enums"]["orx_trust_level"]
          updated_at?: string
        }
        Update: {
          conflict_group_id?: string | null
          content_hash?: string
          contextual_only?: boolean
          created_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["orx_entity_type"]
          evidence_status?: Database["public"]["Enums"]["orx_evidence_status"]
          extraction_confidence?: number | null
          freshness_date?: string | null
          id?: string
          language_code?: string | null
          layer?: string
          methodology_version?: string
          observed_at?: string
          rejection_reason?: string | null
          signal_family?: string
          snippet?: string | null
          source_domain?: string
          source_title?: string | null
          source_type?: Database["public"]["Enums"]["orx_source_type"]
          source_url?: string
          trust_level?: Database["public"]["Enums"]["orx_trust_level"]
          updated_at?: string
        }
        Relationships: []
      }
      orx_fact_transitions: {
        Row: {
          created_at: string
          fact_id: string
          from_status: string
          id: string
          metadata: Json | null
          reason: string | null
          to_status: string
          transitioned_by: string | null
        }
        Insert: {
          created_at?: string
          fact_id: string
          from_status: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          to_status: string
          transitioned_by?: string | null
        }
        Update: {
          created_at?: string
          fact_id?: string
          from_status?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          to_status?: string
          transitioned_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orx_fact_transitions_fact_id_fkey"
            columns: ["fact_id"]
            isOneToOne: false
            referencedRelation: "orx_dimension_facts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orx_fact_transitions_fact_id_fkey"
            columns: ["fact_id"]
            isOneToOne: false
            referencedRelation: "vw_orx_dimension_facts_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orx_fact_transitions_fact_id_fkey"
            columns: ["fact_id"]
            isOneToOne: false
            referencedRelation: "vw_orx_dimension_facts_published"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orx_fact_transitions_fact_id_fkey"
            columns: ["fact_id"]
            isOneToOne: false
            referencedRelation: "vw_orx_facts_approved_unpublished"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orx_fact_transitions_fact_id_fkey"
            columns: ["fact_id"]
            isOneToOne: false
            referencedRelation: "vw_orx_facts_pending_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orx_fact_transitions_fact_id_fkey"
            columns: ["fact_id"]
            isOneToOne: false
            referencedRelation: "vw_orx_facts_published"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orx_fact_transitions_fact_id_fkey"
            columns: ["fact_id"]
            isOneToOne: false
            referencedRelation: "vw_orx_facts_rejected"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orx_fact_transitions_fact_id_fkey"
            columns: ["fact_id"]
            isOneToOne: false
            referencedRelation: "vw_orx_facts_stale"
            referencedColumns: ["id"]
          },
        ]
      }
      orx_score_history: {
        Row: {
          badges: Database["public"]["Enums"]["orx_badge"][] | null
          confidence: number | null
          country_score: number | null
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["orx_entity_type"]
          evaluated_at: string
          evidence_summary: Json | null
          id: string
          methodology_version: string | null
          program_score: number | null
          rank_country: number | null
          rank_global: number | null
          score: number | null
          university_score: number | null
        }
        Insert: {
          badges?: Database["public"]["Enums"]["orx_badge"][] | null
          confidence?: number | null
          country_score?: number | null
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["orx_entity_type"]
          evaluated_at?: string
          evidence_summary?: Json | null
          id?: string
          methodology_version?: string | null
          program_score?: number | null
          rank_country?: number | null
          rank_global?: number | null
          score?: number | null
          university_score?: number | null
        }
        Update: {
          badges?: Database["public"]["Enums"]["orx_badge"][] | null
          confidence?: number | null
          country_score?: number | null
          created_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["orx_entity_type"]
          evaluated_at?: string
          evidence_summary?: Json | null
          id?: string
          methodology_version?: string | null
          program_score?: number | null
          rank_country?: number | null
          rank_global?: number | null
          score?: number | null
          university_score?: number | null
        }
        Relationships: []
      }
      orx_scores: {
        Row: {
          badges: Database["public"]["Enums"]["orx_badge"][] | null
          beta_approved_at: string | null
          beta_approved_by: string | null
          calibration_passed: boolean
          calibration_reviewed: boolean
          confidence: number | null
          country_score: number | null
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["orx_entity_type"]
          evaluated_at: string | null
          evidence_summary: Json | null
          exposure_status: Database["public"]["Enums"]["orx_exposure_status"]
          id: string
          methodology_version: string | null
          program_score: number | null
          rank_country: number | null
          rank_global: number | null
          score: number | null
          status: Database["public"]["Enums"]["orx_status"]
          summary: string | null
          university_score: number | null
          updated_at: string
        }
        Insert: {
          badges?: Database["public"]["Enums"]["orx_badge"][] | null
          beta_approved_at?: string | null
          beta_approved_by?: string | null
          calibration_passed?: boolean
          calibration_reviewed?: boolean
          confidence?: number | null
          country_score?: number | null
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["orx_entity_type"]
          evaluated_at?: string | null
          evidence_summary?: Json | null
          exposure_status?: Database["public"]["Enums"]["orx_exposure_status"]
          id?: string
          methodology_version?: string | null
          program_score?: number | null
          rank_country?: number | null
          rank_global?: number | null
          score?: number | null
          status?: Database["public"]["Enums"]["orx_status"]
          summary?: string | null
          university_score?: number | null
          updated_at?: string
        }
        Update: {
          badges?: Database["public"]["Enums"]["orx_badge"][] | null
          beta_approved_at?: string | null
          beta_approved_by?: string | null
          calibration_passed?: boolean
          calibration_reviewed?: boolean
          confidence?: number | null
          country_score?: number | null
          created_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["orx_entity_type"]
          evaluated_at?: string | null
          evidence_summary?: Json | null
          exposure_status?: Database["public"]["Enums"]["orx_exposure_status"]
          id?: string
          methodology_version?: string | null
          program_score?: number | null
          rank_country?: number | null
          rank_global?: number | null
          score?: number | null
          status?: Database["public"]["Enums"]["orx_status"]
          summary?: string | null
          university_score?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      packages: {
        Row: {
          currency: string | null
          id: string
          included_services: string[] | null
          name: string
          price: number | null
        }
        Insert: {
          currency?: string | null
          id?: string
          included_services?: string[] | null
          name: string
          price?: number | null
        }
        Update: {
          currency?: string | null
          id?: string
          included_services?: string[] | null
          name?: string
          price?: number | null
        }
        Relationships: []
      }
      page_activity_log: {
        Row: {
          action_type: string
          actor_user_id: string
          created_at: string
          id: string
          metadata: Json
          target_id: string | null
          target_type: string | null
          university_id: string | null
        }
        Insert: {
          action_type: string
          actor_user_id: string
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
          university_id?: string | null
        }
        Update: {
          action_type?: string
          actor_user_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
          university_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_activity_log_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "page_activity_log_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "page_activity_log_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_activity_log_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "page_activity_log_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "page_activity_log_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "page_activity_log_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "page_activity_log_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "page_activity_log_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_activity_log_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "page_activity_log_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "page_activity_log_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      page_edit_proposals: {
        Row: {
          created_at: string
          edit_id: string | null
          id: string
          page_space_id: number | null
          payload: Json
          proposal_type: string
          reviewer_id: string | null
          reviewer_metadata: Json
          status: string
          submitted_by: string
          university_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          edit_id?: string | null
          id?: string
          page_space_id?: number | null
          payload?: Json
          proposal_type: string
          reviewer_id?: string | null
          reviewer_metadata?: Json
          status?: string
          submitted_by: string
          university_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          edit_id?: string | null
          id?: string
          page_space_id?: number | null
          payload?: Json
          proposal_type?: string
          reviewer_id?: string | null
          reviewer_metadata?: Json
          status?: string
          submitted_by?: string
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_edit_proposals_edit_id_fkey"
            columns: ["edit_id"]
            isOneToOne: false
            referencedRelation: "institution_page_edits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_edit_proposals_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "page_edit_proposals_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "page_edit_proposals_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_edit_proposals_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "page_edit_proposals_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "page_edit_proposals_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "page_edit_proposals_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "page_edit_proposals_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "page_edit_proposals_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_edit_proposals_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "page_edit_proposals_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "page_edit_proposals_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      page_mutation_history: {
        Row: {
          actor_user_id: string
          after_payload: Json
          before_payload: Json
          created_at: string
          id: string
          mutation_type: string
          proposal_id: string | null
          university_id: string
        }
        Insert: {
          actor_user_id: string
          after_payload?: Json
          before_payload?: Json
          created_at?: string
          id?: string
          mutation_type: string
          proposal_id?: string | null
          university_id: string
        }
        Update: {
          actor_user_id?: string
          after_payload?: Json
          before_payload?: Json
          created_at?: string
          id?: string
          mutation_type?: string
          proposal_id?: string | null
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_mutation_history_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "institution_page_edits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_mutation_history_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "page_mutation_history_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "page_mutation_history_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_mutation_history_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "page_mutation_history_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "page_mutation_history_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "page_mutation_history_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "page_mutation_history_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "page_mutation_history_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_mutation_history_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "page_mutation_history_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "page_mutation_history_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      paid_services: {
        Row: {
          category: string
          created_at: string
          currency_override: string | null
          description_key: string
          display_order: number
          features: Json
          id: string
          is_active: boolean
          is_popular: boolean
          name_key: string
          price_usd: number
          region_id: string
          tier: string | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          currency_override?: string | null
          description_key?: string
          display_order?: number
          features?: Json
          id?: string
          is_active?: boolean
          is_popular?: boolean
          name_key: string
          price_usd?: number
          region_id: string
          tier?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          currency_override?: string | null
          description_key?: string
          display_order?: number
          features?: Json
          id?: string
          is_active?: boolean
          is_popular?: boolean
          name_key?: string
          price_usd?: number
          region_id?: string
          tier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paid_services_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "service_regions"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_identities: {
        Row: {
          created_at: string | null
          phone: string
          user_id: string | null
          visitor_id: string
        }
        Insert: {
          created_at?: string | null
          phone: string
          user_id?: string | null
          visitor_id: string
        }
        Update: {
          created_at?: string | null
          phone?: string
          user_id?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_identities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      pipeline_health_events: {
        Row: {
          batch_id: string | null
          created_at: string
          details: Json | null
          details_json: Json | null
          event_type: string
          id: number
          metric: string | null
          pipeline: string
          reason: string | null
          shard_id: number | null
          value: number | null
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          details?: Json | null
          details_json?: Json | null
          event_type: string
          id?: number
          metric?: string | null
          pipeline: string
          reason?: string | null
          shard_id?: number | null
          value?: number | null
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          details?: Json | null
          details_json?: Json | null
          event_type?: string
          id?: number
          metric?: string | null
          pipeline?: string
          reason?: string | null
          shard_id?: number | null
          value?: number | null
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: []
      }
      portal_applications_v1: {
        Row: {
          auth_user_id: string
          country_code: string | null
          created_at: string
          currency: string
          id: string
          payment_id: string | null
          program_id: string
          program_name: string | null
          services_json: Json
          status: string
          total_amount: number
          university_name: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          country_code?: string | null
          created_at?: string
          currency?: string
          id?: string
          payment_id?: string | null
          program_id: string
          program_name?: string | null
          services_json?: Json
          status?: string
          total_amount?: number
          university_name?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          country_code?: string | null
          created_at?: string
          currency?: string
          id?: string
          payment_id?: string | null
          program_id?: string
          program_name?: string | null
          services_json?: Json
          status?: string
          total_amount?: number
          university_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      portal_customer_map: {
        Row: {
          created_at: string | null
          crm_customer_id: string
          phone_e164: string | null
          portal_auth_user_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          crm_customer_id: string
          phone_e164?: string | null
          portal_auth_user_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          crm_customer_id?: string
          phone_e164?: string | null
          portal_auth_user_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      portal_files_v1: {
        Row: {
          admin_notes: string | null
          application_id: string | null
          auth_user_id: string
          created_at: string
          file_kind: string
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          status: string
          storage_bucket: string
          storage_path: string
          title: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          application_id?: string | null
          auth_user_id: string
          created_at?: string
          file_kind: string
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          status?: string
          storage_bucket?: string
          storage_path: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          application_id?: string | null
          auth_user_id?: string
          created_at?: string
          file_kind?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          status?: string
          storage_bucket?: string
          storage_path?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_files_v1_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "portal_applications_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_files_v1_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "vw_portal_applications_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_payments_v1: {
        Row: {
          amount_required: number
          application_id: string
          auth_user_id: string
          created_at: string
          currency: string
          evidence_storage_bucket: string | null
          evidence_storage_path: string | null
          id: string
          paid_at: string | null
          payment_method: string | null
          provider: string | null
          provider_payment_intent_id: string | null
          provider_session_id: string | null
          receipt_no: string | null
          receipt_url: string | null
          reference: string | null
          rejected_at: string | null
          rejection_reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_required?: number
          application_id: string
          auth_user_id: string
          created_at?: string
          currency?: string
          evidence_storage_bucket?: string | null
          evidence_storage_path?: string | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          provider?: string | null
          provider_payment_intent_id?: string | null
          provider_session_id?: string | null
          receipt_no?: string | null
          receipt_url?: string | null
          reference?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_required?: number
          application_id?: string
          auth_user_id?: string
          created_at?: string
          currency?: string
          evidence_storage_bucket?: string | null
          evidence_storage_path?: string | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          provider?: string | null
          provider_payment_intent_id?: string | null
          provider_session_id?: string | null
          receipt_no?: string | null
          receipt_url?: string | null
          reference?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_payments_v1_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "portal_applications_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_payments_v1_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "vw_portal_applications_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_shortlist: {
        Row: {
          auth_user_id: string
          created_at: string
          id: string
          program_id: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          id?: string
          program_id: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          id?: string
          program_id?: string
        }
        Relationships: []
      }
      portal_shortlist_universities: {
        Row: {
          auth_user_id: string
          created_at: string
          id: string
          university_id: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          id?: string
          university_id: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          id?: string
          university_id?: string
        }
        Relationships: []
      }
      portal_tokens: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          issued_by: string | null
          profile_id: string
          token: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          issued_by?: string | null
          profile_id: string
          token?: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          issued_by?: string | null
          profile_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      posts: {
        Row: {
          body: string | null
          excerpt: string | null
          featured: boolean | null
          id: string
          image_url: string | null
          published_at: string | null
          slug: string
          title: string
          type: string | null
        }
        Insert: {
          body?: string | null
          excerpt?: string | null
          featured?: boolean | null
          id?: string
          image_url?: string | null
          published_at?: string | null
          slug: string
          title: string
          type?: string | null
        }
        Update: {
          body?: string | null
          excerpt?: string | null
          featured?: boolean | null
          id?: string
          image_url?: string | null
          published_at?: string | null
          slug?: string
          title?: string
          type?: string | null
        }
        Relationships: []
      }
      preferred_universities: {
        Row: {
          country_code: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          preferred_rank: number | null
          reason_short: string | null
          university_id: string
          updated_at: string | null
        }
        Insert: {
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          preferred_rank?: number | null
          reason_short?: string | null
          university_id: string
          updated_at?: string | null
        }
        Update: {
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          preferred_rank?: number | null
          reason_short?: string | null
          university_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      price_observations: {
        Row: {
          academic_year: string | null
          amount: number | null
          amount_max: number | null
          amount_min: number | null
          amount_usd: number | null
          audience: string | null
          conditions_note: string | null
          confidence: number | null
          created_at: string | null
          currency: string | null
          degree_level: string | null
          id: string
          is_official: boolean | null
          observed_at: string | null
          period: string | null
          price_type: string | null
          program_id: string | null
          source_id: string | null
          source_url: string | null
          university_id: string
        }
        Insert: {
          academic_year?: string | null
          amount?: number | null
          amount_max?: number | null
          amount_min?: number | null
          amount_usd?: number | null
          audience?: string | null
          conditions_note?: string | null
          confidence?: number | null
          created_at?: string | null
          currency?: string | null
          degree_level?: string | null
          id?: string
          is_official?: boolean | null
          observed_at?: string | null
          period?: string | null
          price_type?: string | null
          program_id?: string | null
          source_id?: string | null
          source_url?: string | null
          university_id: string
        }
        Update: {
          academic_year?: string | null
          amount?: number | null
          amount_max?: number | null
          amount_min?: number | null
          amount_usd?: number | null
          audience?: string | null
          conditions_note?: string | null
          confidence?: number | null
          created_at?: string | null
          currency?: string | null
          degree_level?: string | null
          id?: string
          is_official?: boolean | null
          observed_at?: string | null
          period?: string | null
          price_type?: string | null
          program_id?: string | null
          source_id?: string | null
          source_url?: string | null
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_observations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "price_observations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_observations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "price_observations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "price_observations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "price_observations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "price_observations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "price_observations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "price_observations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "price_observations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "price_observations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_observations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "price_observations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "price_observations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "price_observations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "price_observations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "price_observations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_observations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "price_observations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "price_observations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_settings: {
        Row: {
          discount_pct: number | null
          dynamic_discount_enabled: boolean | null
          hint_threshold: number | null
          id: boolean
        }
        Insert: {
          discount_pct?: number | null
          dynamic_discount_enabled?: boolean | null
          hint_threshold?: number | null
          id?: boolean
        }
        Update: {
          discount_pct?: number | null
          dynamic_discount_enabled?: boolean | null
          hint_threshold?: number | null
          id?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activation_status: string
          avatar_storage_path: string | null
          city: string | null
          country: string | null
          created_at: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string | null
          is_sandbox: boolean
          national_id: string | null
          phone: string | null
          sandbox_owner: string | null
          student_progress: number | null
          student_substage: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activation_status?: string
          avatar_storage_path?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string | null
          is_sandbox?: boolean
          national_id?: string | null
          phone?: string | null
          sandbox_owner?: string | null
          student_progress?: number | null
          student_substage?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activation_status?: string
          avatar_storage_path?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string | null
          is_sandbox?: boolean
          national_id?: string | null
          phone?: string | null
          sandbox_owner?: string | null
          student_progress?: number | null
          student_substage?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      program_admission_routes: {
        Row: {
          confidence: number | null
          created_at: string | null
          evidence_snippet: string | null
          id: string
          platform_name: string | null
          platform_url: string | null
          pre_enrolment_platform: string | null
          pre_enrolment_required: boolean | null
          pre_enrolment_url: string | null
          preparatory_route_name: string | null
          preparatory_route_notes: string | null
          preparatory_route_required: boolean | null
          preparatory_route_type: string | null
          program_id: string | null
          required_before_university_apply: boolean | null
          review_status: string | null
          route_notes: string | null
          route_type: string
          source_url: string | null
          university_id: string | null
          updated_at: string | null
          visa_route_notes: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          evidence_snippet?: string | null
          id?: string
          platform_name?: string | null
          platform_url?: string | null
          pre_enrolment_platform?: string | null
          pre_enrolment_required?: boolean | null
          pre_enrolment_url?: string | null
          preparatory_route_name?: string | null
          preparatory_route_notes?: string | null
          preparatory_route_required?: boolean | null
          preparatory_route_type?: string | null
          program_id?: string | null
          required_before_university_apply?: boolean | null
          review_status?: string | null
          route_notes?: string | null
          route_type?: string
          source_url?: string | null
          university_id?: string | null
          updated_at?: string | null
          visa_route_notes?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          evidence_snippet?: string | null
          id?: string
          platform_name?: string | null
          platform_url?: string | null
          pre_enrolment_platform?: string | null
          pre_enrolment_required?: boolean | null
          pre_enrolment_url?: string | null
          preparatory_route_name?: string | null
          preparatory_route_notes?: string | null
          preparatory_route_required?: boolean | null
          preparatory_route_type?: string | null
          program_id?: string | null
          required_before_university_apply?: boolean | null
          review_status?: string | null
          route_notes?: string | null
          route_type?: string
          source_url?: string | null
          university_id?: string | null
          updated_at?: string | null
          visa_route_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_admission_routes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_admission_routes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_admission_routes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_admission_routes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_admission_routes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_admission_routes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_admission_routes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_admission_routes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_admission_routes_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_admission_routes_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_admission_routes_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_admission_routes_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_admission_routes_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_admission_routes_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_admission_routes_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_admission_routes_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "program_admission_routes_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_admission_routes_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_admission_routes_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_admission_routes_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      program_ai_snapshots: {
        Row: {
          best_fit_profile: string | null
          career_paths: Json | null
          confidence: number | null
          created_at: string | null
          expires_at: string | null
          future_outlook: string | null
          generated_at: string | null
          id: string
          is_current: boolean | null
          model_version: string | null
          practical_assessment: string | null
          program_id: string
          source_hash: string | null
          strengths: Json | null
          summary: string | null
          weaknesses: Json | null
        }
        Insert: {
          best_fit_profile?: string | null
          career_paths?: Json | null
          confidence?: number | null
          created_at?: string | null
          expires_at?: string | null
          future_outlook?: string | null
          generated_at?: string | null
          id?: string
          is_current?: boolean | null
          model_version?: string | null
          practical_assessment?: string | null
          program_id: string
          source_hash?: string | null
          strengths?: Json | null
          summary?: string | null
          weaknesses?: Json | null
        }
        Update: {
          best_fit_profile?: string | null
          career_paths?: Json | null
          confidence?: number | null
          created_at?: string | null
          expires_at?: string | null
          future_outlook?: string | null
          generated_at?: string | null
          id?: string
          is_current?: boolean | null
          model_version?: string | null
          practical_assessment?: string | null
          program_id?: string
          source_hash?: string | null
          strengths?: Json | null
          summary?: string | null
          weaknesses?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "program_ai_snapshots_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_ai_snapshots_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_ai_snapshots_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_ai_snapshots_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_ai_snapshots_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_ai_snapshots_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_ai_snapshots_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_ai_snapshots_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["program_id"]
          },
        ]
      }
      program_aliases: {
        Row: {
          alias: string
          alias_normalized: string | null
          created_at: string
          id: string
          lang_code: string
          priority: number
          program_id: string
          source: string | null
        }
        Insert: {
          alias: string
          alias_normalized?: string | null
          created_at?: string
          id?: string
          lang_code: string
          priority?: number
          program_id: string
          source?: string | null
        }
        Update: {
          alias?: string
          alias_normalized?: string | null
          created_at?: string
          id?: string
          lang_code?: string
          priority?: number
          program_id?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_aliases_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_aliases_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_aliases_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_aliases_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_aliases_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_aliases_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_aliases_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_aliases_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["program_id"]
          },
        ]
      }
      program_deadlines: {
        Row: {
          academic_year: string | null
          confidence: number | null
          created_at: string | null
          deadline_date: string | null
          deadline_text: string | null
          deadline_type: string
          evidence_snippet: string | null
          id: string
          program_id: string | null
          review_status: string | null
          source_url: string | null
          university_id: string | null
        }
        Insert: {
          academic_year?: string | null
          confidence?: number | null
          created_at?: string | null
          deadline_date?: string | null
          deadline_text?: string | null
          deadline_type: string
          evidence_snippet?: string | null
          id?: string
          program_id?: string | null
          review_status?: string | null
          source_url?: string | null
          university_id?: string | null
        }
        Update: {
          academic_year?: string | null
          confidence?: number | null
          created_at?: string | null
          deadline_date?: string | null
          deadline_text?: string | null
          deadline_type?: string
          evidence_snippet?: string | null
          id?: string
          program_id?: string | null
          review_status?: string | null
          source_url?: string | null
          university_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_deadlines_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_deadlines_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_deadlines_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_deadlines_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_deadlines_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_deadlines_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_deadlines_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_deadlines_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_deadlines_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_deadlines_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_deadlines_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_deadlines_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_deadlines_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_deadlines_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_deadlines_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_deadlines_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "program_deadlines_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_deadlines_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_deadlines_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_deadlines_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      program_draft: {
        Row: {
          admissions_source_url: string | null
          application_fee: number | null
          approval_tier: string | null
          batch_id: string | null
          confidence_score: number | null
          content_hash: string | null
          country_code: string | null
          created_at: string | null
          currency: string | null
          currency_code: string | null
          degree_level: string | null
          duration_months: number | null
          ects_credits: number | null
          extracted_json: Json | null
          extractor_version: string | null
          fee_as_of_year: string | null
          fee_captured_at: string | null
          fee_content_hash: string | null
          field_evidence_map: Json | null
          final_confidence: number | null
          fingerprint: string | null
          flags: string[] | null
          gpt5_reasoning: string | null
          id: number
          intake_months: string[] | null
          language: string | null
          last_extracted_at: string | null
          last_verified_at: string | null
          missing_fields: string[] | null
          program_key: string | null
          program_slug: string | null
          publish_trace_id: string | null
          published_at: string | null
          published_by: string | null
          published_program_id: string | null
          raw_page_id: number | null
          rejection_reasons: Json | null
          requirements: string[] | null
          review_status: string
          schema_version: string
          source_program_url: string | null
          source_url: string | null
          status: string | null
          title: string
          title_en: string | null
          tuition_fee: number | null
          tuition_source_url: string | null
          university_id: string | null
          university_name: string | null
          verification_result: Json | null
        }
        Insert: {
          admissions_source_url?: string | null
          application_fee?: number | null
          approval_tier?: string | null
          batch_id?: string | null
          confidence_score?: number | null
          content_hash?: string | null
          country_code?: string | null
          created_at?: string | null
          currency?: string | null
          currency_code?: string | null
          degree_level?: string | null
          duration_months?: number | null
          ects_credits?: number | null
          extracted_json?: Json | null
          extractor_version?: string | null
          fee_as_of_year?: string | null
          fee_captured_at?: string | null
          fee_content_hash?: string | null
          field_evidence_map?: Json | null
          final_confidence?: number | null
          fingerprint?: string | null
          flags?: string[] | null
          gpt5_reasoning?: string | null
          id?: number
          intake_months?: string[] | null
          language?: string | null
          last_extracted_at?: string | null
          last_verified_at?: string | null
          missing_fields?: string[] | null
          program_key?: string | null
          program_slug?: string | null
          publish_trace_id?: string | null
          published_at?: string | null
          published_by?: string | null
          published_program_id?: string | null
          raw_page_id?: number | null
          rejection_reasons?: Json | null
          requirements?: string[] | null
          review_status?: string
          schema_version?: string
          source_program_url?: string | null
          source_url?: string | null
          status?: string | null
          title: string
          title_en?: string | null
          tuition_fee?: number | null
          tuition_source_url?: string | null
          university_id?: string | null
          university_name?: string | null
          verification_result?: Json | null
        }
        Update: {
          admissions_source_url?: string | null
          application_fee?: number | null
          approval_tier?: string | null
          batch_id?: string | null
          confidence_score?: number | null
          content_hash?: string | null
          country_code?: string | null
          created_at?: string | null
          currency?: string | null
          currency_code?: string | null
          degree_level?: string | null
          duration_months?: number | null
          ects_credits?: number | null
          extracted_json?: Json | null
          extractor_version?: string | null
          fee_as_of_year?: string | null
          fee_captured_at?: string | null
          fee_content_hash?: string | null
          field_evidence_map?: Json | null
          final_confidence?: number | null
          fingerprint?: string | null
          flags?: string[] | null
          gpt5_reasoning?: string | null
          id?: number
          intake_months?: string[] | null
          language?: string | null
          last_extracted_at?: string | null
          last_verified_at?: string | null
          missing_fields?: string[] | null
          program_key?: string | null
          program_slug?: string | null
          publish_trace_id?: string | null
          published_at?: string | null
          published_by?: string | null
          published_program_id?: string | null
          raw_page_id?: number | null
          rejection_reasons?: Json | null
          requirements?: string[] | null
          review_status?: string
          schema_version?: string
          source_program_url?: string | null
          source_url?: string | null
          status?: string | null
          title?: string
          title_en?: string | null
          tuition_fee?: number | null
          tuition_source_url?: string | null
          university_id?: string | null
          university_name?: string | null
          verification_result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "program_draft_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "crawl_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "program_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      program_draft_archive: {
        Row: {
          admissions_source_url: string | null
          application_fee: number | null
          approval_tier: string | null
          archive_reason: string
          archived_at: string
          batch_id: string | null
          confidence_score: number | null
          content_hash: string | null
          country_code: string | null
          created_at: string | null
          currency: string | null
          currency_code: string | null
          degree_level: string | null
          duration_months: number | null
          extracted_json: Json | null
          extractor_version: string | null
          fee_as_of_year: string | null
          fee_captured_at: string | null
          fee_content_hash: string | null
          field_evidence_map: Json | null
          final_confidence: number | null
          fingerprint: string | null
          flags: string[] | null
          gpt5_reasoning: string | null
          id: number
          intake_months: string[] | null
          language: string | null
          last_extracted_at: string | null
          last_verified_at: string | null
          missing_fields: string[] | null
          program_key: string | null
          program_slug: string | null
          publish_trace_id: string | null
          published_at: string | null
          published_by: string | null
          published_program_id: string | null
          raw_page_id: number | null
          rejection_reasons: Json | null
          requirements: string[] | null
          review_status: string
          schema_version: string
          source_program_url: string | null
          source_url: string | null
          status: string | null
          title: string
          title_en: string | null
          tuition_fee: number | null
          tuition_source_url: string | null
          university_id: string | null
          university_name: string | null
          verification_result: Json | null
        }
        Insert: {
          admissions_source_url?: string | null
          application_fee?: number | null
          approval_tier?: string | null
          archive_reason: string
          archived_at?: string
          batch_id?: string | null
          confidence_score?: number | null
          content_hash?: string | null
          country_code?: string | null
          created_at?: string | null
          currency?: string | null
          currency_code?: string | null
          degree_level?: string | null
          duration_months?: number | null
          extracted_json?: Json | null
          extractor_version?: string | null
          fee_as_of_year?: string | null
          fee_captured_at?: string | null
          fee_content_hash?: string | null
          field_evidence_map?: Json | null
          final_confidence?: number | null
          fingerprint?: string | null
          flags?: string[] | null
          gpt5_reasoning?: string | null
          id?: number
          intake_months?: string[] | null
          language?: string | null
          last_extracted_at?: string | null
          last_verified_at?: string | null
          missing_fields?: string[] | null
          program_key?: string | null
          program_slug?: string | null
          publish_trace_id?: string | null
          published_at?: string | null
          published_by?: string | null
          published_program_id?: string | null
          raw_page_id?: number | null
          rejection_reasons?: Json | null
          requirements?: string[] | null
          review_status?: string
          schema_version?: string
          source_program_url?: string | null
          source_url?: string | null
          status?: string | null
          title: string
          title_en?: string | null
          tuition_fee?: number | null
          tuition_source_url?: string | null
          university_id?: string | null
          university_name?: string | null
          verification_result?: Json | null
        }
        Update: {
          admissions_source_url?: string | null
          application_fee?: number | null
          approval_tier?: string | null
          archive_reason?: string
          archived_at?: string
          batch_id?: string | null
          confidence_score?: number | null
          content_hash?: string | null
          country_code?: string | null
          created_at?: string | null
          currency?: string | null
          currency_code?: string | null
          degree_level?: string | null
          duration_months?: number | null
          extracted_json?: Json | null
          extractor_version?: string | null
          fee_as_of_year?: string | null
          fee_captured_at?: string | null
          fee_content_hash?: string | null
          field_evidence_map?: Json | null
          final_confidence?: number | null
          fingerprint?: string | null
          flags?: string[] | null
          gpt5_reasoning?: string | null
          id?: number
          intake_months?: string[] | null
          language?: string | null
          last_extracted_at?: string | null
          last_verified_at?: string | null
          missing_fields?: string[] | null
          program_key?: string | null
          program_slug?: string | null
          publish_trace_id?: string | null
          published_at?: string | null
          published_by?: string | null
          published_program_id?: string | null
          raw_page_id?: number | null
          rejection_reasons?: Json | null
          requirements?: string[] | null
          review_status?: string
          schema_version?: string
          source_program_url?: string | null
          source_url?: string | null
          status?: string | null
          title?: string
          title_en?: string | null
          tuition_fee?: number | null
          tuition_source_url?: string | null
          university_id?: string | null
          university_name?: string | null
          verification_result?: Json | null
        }
        Relationships: []
      }
      program_eligibility_rules: {
        Row: {
          applies_to_countries: string[] | null
          condition_text: string | null
          condition_type: string | null
          confidence: number | null
          created_at: string | null
          evidence_snippet: string | null
          id: string
          linked_document: string | null
          linked_exam: string | null
          linked_route: string | null
          min_value: number | null
          program_id: string | null
          review_status: string | null
          rule_type: string
          source_url: string | null
          university_id: string | null
        }
        Insert: {
          applies_to_countries?: string[] | null
          condition_text?: string | null
          condition_type?: string | null
          confidence?: number | null
          created_at?: string | null
          evidence_snippet?: string | null
          id?: string
          linked_document?: string | null
          linked_exam?: string | null
          linked_route?: string | null
          min_value?: number | null
          program_id?: string | null
          review_status?: string | null
          rule_type: string
          source_url?: string | null
          university_id?: string | null
        }
        Update: {
          applies_to_countries?: string[] | null
          condition_text?: string | null
          condition_type?: string | null
          confidence?: number | null
          created_at?: string | null
          evidence_snippet?: string | null
          id?: string
          linked_document?: string | null
          linked_exam?: string | null
          linked_route?: string | null
          min_value?: number | null
          program_id?: string | null
          review_status?: string | null
          rule_type?: string
          source_url?: string | null
          university_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_eligibility_rules_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_eligibility_rules_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_eligibility_rules_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_eligibility_rules_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_eligibility_rules_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_eligibility_rules_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_eligibility_rules_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_eligibility_rules_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_eligibility_rules_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_eligibility_rules_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_eligibility_rules_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_eligibility_rules_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_eligibility_rules_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_eligibility_rules_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_eligibility_rules_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_eligibility_rules_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "program_eligibility_rules_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_eligibility_rules_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_eligibility_rules_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_eligibility_rules_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      program_i18n: {
        Row: {
          description: string | null
          lang_code: string
          name: string | null
          outcomes: Json | null
          program_id: string
          quality_score: number
          source: string | null
          updated_at: string
        }
        Insert: {
          description?: string | null
          lang_code: string
          name?: string | null
          outcomes?: Json | null
          program_id: string
          quality_score?: number
          source?: string | null
          updated_at?: string
        }
        Update: {
          description?: string | null
          lang_code?: string
          name?: string | null
          outcomes?: Json | null
          program_id?: string
          quality_score?: number
          source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_i18n_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_i18n_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_i18n_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_i18n_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_i18n_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_i18n_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_i18n_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_i18n_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["program_id"]
          },
        ]
      }
      program_ingestion_jobs: {
        Row: {
          ai_result: Json | null
          completed_at: string | null
          created_at: string | null
          error: string | null
          file_name: string | null
          file_path: string
          file_type: string | null
          id: string
          model_used: string | null
          status: string | null
          university_id: string
          uploaded_by: string
        }
        Insert: {
          ai_result?: Json | null
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          file_name?: string | null
          file_path: string
          file_type?: string | null
          id?: string
          model_used?: string | null
          status?: string | null
          university_id: string
          uploaded_by: string
        }
        Update: {
          ai_result?: Json | null
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          file_name?: string | null
          file_path?: string
          file_type?: string | null
          id?: string
          model_used?: string | null
          status?: string | null
          university_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_ingestion_jobs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_ingestion_jobs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_ingestion_jobs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_ingestion_jobs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_ingestion_jobs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_ingestion_jobs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_ingestion_jobs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_ingestion_jobs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "program_ingestion_jobs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_ingestion_jobs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_ingestion_jobs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_ingestion_jobs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      program_ingestion_proposals: {
        Row: {
          confidence: number | null
          created_at: string | null
          evidence_snippet: string | null
          id: string
          job_id: string
          proposed_value: Json
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          target_entity: string
          target_field: string
          target_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          evidence_snippet?: string | null
          id?: string
          job_id: string
          proposed_value: Json
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          target_entity: string
          target_field: string
          target_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          evidence_snippet?: string | null
          id?: string
          job_id?: string
          proposed_value?: Json
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          target_entity?: string
          target_field?: string
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_ingestion_proposals_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "program_ingestion_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_intakes: {
        Row: {
          created_at: string | null
          id: string
          intake_date: string
          intake_label: string | null
          program_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          intake_date: string
          intake_label?: string | null
          program_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          intake_date?: string
          intake_label?: string | null
          program_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_intakes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_intakes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_intakes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_intakes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_intakes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_intakes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_intakes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_intakes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["program_id"]
          },
        ]
      }
      program_languages: {
        Row: {
          created_at: string
          language_code: string
          program_id: string
        }
        Insert: {
          created_at?: string
          language_code: string
          program_id: string
        }
        Update: {
          created_at?: string
          language_code?: string
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_languages_language_fk"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "program_languages_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_languages_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_languages_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_languages_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_languages_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_languages_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_languages_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_languages_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["program_id"]
          },
        ]
      }
      program_offers: {
        Row: {
          application_deadline: string | null
          apply_url: string | null
          campus: string | null
          created_at: string | null
          currency_code: string | null
          delivery_mode: string | null
          department: string | null
          faculty: string | null
          id: string
          intake_term: string | null
          intake_year: number | null
          offer_status: string | null
          program_id: string
          seats_available: number | null
          seats_status: string | null
          seats_total: number | null
          study_mode: string | null
          teaching_language: string | null
          tuition_amount: number | null
          tuition_basis: string | null
          university_id: string
          updated_at: string | null
          waitlist_count: number | null
        }
        Insert: {
          application_deadline?: string | null
          apply_url?: string | null
          campus?: string | null
          created_at?: string | null
          currency_code?: string | null
          delivery_mode?: string | null
          department?: string | null
          faculty?: string | null
          id?: string
          intake_term?: string | null
          intake_year?: number | null
          offer_status?: string | null
          program_id: string
          seats_available?: number | null
          seats_status?: string | null
          seats_total?: number | null
          study_mode?: string | null
          teaching_language?: string | null
          tuition_amount?: number | null
          tuition_basis?: string | null
          university_id: string
          updated_at?: string | null
          waitlist_count?: number | null
        }
        Update: {
          application_deadline?: string | null
          apply_url?: string | null
          campus?: string | null
          created_at?: string | null
          currency_code?: string | null
          delivery_mode?: string | null
          department?: string | null
          faculty?: string | null
          id?: string
          intake_term?: string | null
          intake_year?: number | null
          offer_status?: string | null
          program_id?: string
          seats_available?: number | null
          seats_status?: string | null
          seats_total?: number | null
          study_mode?: string | null
          teaching_language?: string | null
          tuition_amount?: number | null
          tuition_basis?: string | null
          university_id?: string
          updated_at?: string | null
          waitlist_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "program_offers_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_offers_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_offers_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_offers_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_offers_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_offers_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_offers_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_offers_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_offers_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_offers_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_offers_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_offers_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_offers_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_offers_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_offers_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_offers_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "program_offers_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_offers_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_offers_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_offers_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      program_orx_signals: {
        Row: {
          calculated_at: string | null
          capstone_score: number | null
          created_at: string | null
          curriculum_modernity: number | null
          discipline_future_strength: number | null
          employability_relevance: number | null
          evidence: Json | null
          id: string
          industry_links_score: number | null
          internship_score: number | null
          is_current: boolean | null
          labs_score: number | null
          model_version: string | null
          overall_execution_score: number | null
          practical_intensity: number | null
          program_id: string
          source_hash: string | null
          tooling_score: number | null
        }
        Insert: {
          calculated_at?: string | null
          capstone_score?: number | null
          created_at?: string | null
          curriculum_modernity?: number | null
          discipline_future_strength?: number | null
          employability_relevance?: number | null
          evidence?: Json | null
          id?: string
          industry_links_score?: number | null
          internship_score?: number | null
          is_current?: boolean | null
          labs_score?: number | null
          model_version?: string | null
          overall_execution_score?: number | null
          practical_intensity?: number | null
          program_id: string
          source_hash?: string | null
          tooling_score?: number | null
        }
        Update: {
          calculated_at?: string | null
          capstone_score?: number | null
          created_at?: string | null
          curriculum_modernity?: number | null
          discipline_future_strength?: number | null
          employability_relevance?: number | null
          evidence?: Json | null
          id?: string
          industry_links_score?: number | null
          internship_score?: number | null
          is_current?: boolean | null
          labs_score?: number | null
          model_version?: string | null
          overall_execution_score?: number | null
          practical_intensity?: number | null
          program_id?: string
          source_hash?: string | null
          tooling_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "program_orx_signals_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_orx_signals_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_orx_signals_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_orx_signals_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_orx_signals_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_orx_signals_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_orx_signals_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_orx_signals_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["program_id"]
          },
        ]
      }
      program_quarantine: {
        Row: {
          created_at: string | null
          extracted_json: Json | null
          id: number
          original_title: string
          rejection_reason: string
          source_url: string | null
          university_id: string
        }
        Insert: {
          created_at?: string | null
          extracted_json?: Json | null
          id?: number
          original_title: string
          rejection_reason: string
          source_url?: string | null
          university_id: string
        }
        Update: {
          created_at?: string | null
          extracted_json?: Json | null
          id?: number
          original_title?: string
          rejection_reason?: string
          source_url?: string | null
          university_id?: string
        }
        Relationships: []
      }
      program_related_urls: {
        Row: {
          program_draft_id: number
          program_url_id: number
          rel: string
        }
        Insert: {
          program_draft_id: number
          program_url_id: number
          rel: string
        }
        Update: {
          program_draft_id?: number
          program_url_id?: number
          rel?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_related_urls_program_draft_id_fkey"
            columns: ["program_draft_id"]
            isOneToOne: false
            referencedRelation: "door2_review_current_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_related_urls_program_draft_id_fkey"
            columns: ["program_draft_id"]
            isOneToOne: false
            referencedRelation: "program_draft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_related_urls_program_url_id_fkey"
            columns: ["program_url_id"]
            isOneToOne: false
            referencedRelation: "program_urls"
            referencedColumns: ["id"]
          },
        ]
      }
      program_required_documents: {
        Row: {
          certified_copy_required: boolean | null
          confidence: number | null
          created_at: string | null
          document_name: string | null
          document_type: string
          evidence_snippet: string | null
          id: string
          notes: string | null
          program_id: string | null
          review_status: string | null
          source_url: string | null
          translation_required: boolean | null
          university_id: string | null
        }
        Insert: {
          certified_copy_required?: boolean | null
          confidence?: number | null
          created_at?: string | null
          document_name?: string | null
          document_type: string
          evidence_snippet?: string | null
          id?: string
          notes?: string | null
          program_id?: string | null
          review_status?: string | null
          source_url?: string | null
          translation_required?: boolean | null
          university_id?: string | null
        }
        Update: {
          certified_copy_required?: boolean | null
          confidence?: number | null
          created_at?: string | null
          document_name?: string | null
          document_type?: string
          evidence_snippet?: string | null
          id?: string
          notes?: string | null
          program_id?: string | null
          review_status?: string | null
          source_url?: string | null
          translation_required?: boolean | null
          university_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_required_documents_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_required_documents_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_required_documents_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_required_documents_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_required_documents_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_required_documents_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_required_documents_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_required_documents_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_required_documents_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_required_documents_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_required_documents_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_required_documents_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_required_documents_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_required_documents_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_required_documents_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_required_documents_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "program_required_documents_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_required_documents_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_required_documents_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_required_documents_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      program_subjects: {
        Row: {
          created_at: string | null
          is_primary: boolean | null
          program_id: string
          subject_id: string
        }
        Insert: {
          created_at?: string | null
          is_primary?: boolean | null
          program_id: string
          subject_id: string
        }
        Update: {
          created_at?: string | null
          is_primary?: boolean | null
          program_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_subjects_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_subjects_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_subjects_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_subjects_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_subjects_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_subjects_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_subjects_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_subjects_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "program_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      program_urls: {
        Row: {
          attempts: number | null
          batch_id: string | null
          canonical_url: string | null
          created_at: string | null
          discovered_from: string | null
          fetch_error: string | null
          host_key: string | null
          id: number
          kind: string | null
          lease_expires_at: string | null
          locked_at: string | null
          locked_by: string | null
          raw_page_id: number | null
          retry_at: string | null
          status: string | null
          university_id: string | null
          url: string
          url_hash: string | null
        }
        Insert: {
          attempts?: number | null
          batch_id?: string | null
          canonical_url?: string | null
          created_at?: string | null
          discovered_from?: string | null
          fetch_error?: string | null
          host_key?: string | null
          id?: number
          kind?: string | null
          lease_expires_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          raw_page_id?: number | null
          retry_at?: string | null
          status?: string | null
          university_id?: string | null
          url: string
          url_hash?: string | null
        }
        Update: {
          attempts?: number | null
          batch_id?: string | null
          canonical_url?: string | null
          created_at?: string | null
          discovered_from?: string | null
          fetch_error?: string | null
          host_key?: string | null
          id?: number
          kind?: string | null
          lease_expires_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          raw_page_id?: number | null
          retry_at?: string | null
          status?: string | null
          university_id?: string | null
          url?: string
          url_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_urls_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "crawl_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_urls_raw_page_id_fkey"
            columns: ["raw_page_id"]
            isOneToOne: false
            referencedRelation: "raw_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_urls_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_urls_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_urls_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_urls_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_urls_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_urls_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_urls_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_urls_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "program_urls_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_urls_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_urls_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_urls_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          accepted_certificates: string[] | null
          additional_requirements: string | null
          admission_notes_text: string | null
          admission_requirements_json: Json | null
          application_deadline: string | null
          application_fee: number | null
          application_fee_currency: string | null
          apply_url: string | null
          aptitude_assessment_required: boolean | null
          avg_salary: number | null
          cefr_level: string | null
          city: string | null
          content_hash: string | null
          created_at: string | null
          currency_code: string | null
          deadlines: Json | null
          degree_id: string | null
          degree_level: string | null
          delivery_mode: string | null
          description: string | null
          discipline_id: string | null
          duolingo_min: number | null
          duration_months: number | null
          ects_credits: number | null
          employment_rate: number | null
          enrolled_students: number | null
          entrance_exam_required: boolean | null
          entrance_exam_types: string[] | null
          fee_exemption_rule: string | null
          fee_rule_notes: string | null
          fingerprint: string | null
          foundation_required: boolean | null
          gpa_min: number | null
          gpa_required: number | null
          has_internship: boolean | null
          has_scholarship: boolean | null
          has_scholarships: boolean | null
          id: string
          ielts_min_each_section: number | null
          ielts_min_overall: number | null
          ielts_required: number | null
          image_url: string | null
          intake_label: string | null
          intake_months: string[] | null
          interview_required: boolean | null
          is_accredited: boolean | null
          is_active: boolean | null
          language: string | null
          languages: string[] | null
          multi_stage_selection: boolean | null
          next_intake: string | null
          next_intake_date: string | null
          old_price: number | null
          portfolio_required: boolean | null
          prep_year_required: boolean | null
          program_key: string | null
          program_slug: string | null
          pte_min: number | null
          publish_status: string | null
          published: boolean | null
          ranking_selection: boolean | null
          required_documents: Json | null
          requirements: string[] | null
          requirements_text: string | null
          scholarship_amount_usd: number | null
          scholarship_covers_housing: boolean | null
          scholarship_covers_insurance: boolean | null
          scholarship_monthly_stipend_usd: number | null
          scholarship_notes: string | null
          scholarship_percent_coverage: number | null
          scholarship_type: string | null
          school_name: string | null
          seats_available: number | null
          seats_status: string | null
          seats_total: number | null
          selection_notes: string | null
          source_program_url: string | null
          study_mode: string | null
          subject_area: string | null
          teaching_language: string | null
          title: string
          title_ar: string | null
          toefl_min: number | null
          toefl_required: boolean | null
          tuition_basis: string | null
          tuition_domestic: number | null
          tuition_is_free: boolean | null
          tuition_local_max: number | null
          tuition_local_min: number | null
          tuition_scope: string | null
          tuition_usd_max: number | null
          tuition_usd_min: number | null
          tuition_yearly: number | null
          university_id: string
          updated_at: string | null
        }
        Insert: {
          accepted_certificates?: string[] | null
          additional_requirements?: string | null
          admission_notes_text?: string | null
          admission_requirements_json?: Json | null
          application_deadline?: string | null
          application_fee?: number | null
          application_fee_currency?: string | null
          apply_url?: string | null
          aptitude_assessment_required?: boolean | null
          avg_salary?: number | null
          cefr_level?: string | null
          city?: string | null
          content_hash?: string | null
          created_at?: string | null
          currency_code?: string | null
          deadlines?: Json | null
          degree_id?: string | null
          degree_level?: string | null
          delivery_mode?: string | null
          description?: string | null
          discipline_id?: string | null
          duolingo_min?: number | null
          duration_months?: number | null
          ects_credits?: number | null
          employment_rate?: number | null
          enrolled_students?: number | null
          entrance_exam_required?: boolean | null
          entrance_exam_types?: string[] | null
          fee_exemption_rule?: string | null
          fee_rule_notes?: string | null
          fingerprint?: string | null
          foundation_required?: boolean | null
          gpa_min?: number | null
          gpa_required?: number | null
          has_internship?: boolean | null
          has_scholarship?: boolean | null
          has_scholarships?: boolean | null
          id?: string
          ielts_min_each_section?: number | null
          ielts_min_overall?: number | null
          ielts_required?: number | null
          image_url?: string | null
          intake_label?: string | null
          intake_months?: string[] | null
          interview_required?: boolean | null
          is_accredited?: boolean | null
          is_active?: boolean | null
          language?: string | null
          languages?: string[] | null
          multi_stage_selection?: boolean | null
          next_intake?: string | null
          next_intake_date?: string | null
          old_price?: number | null
          portfolio_required?: boolean | null
          prep_year_required?: boolean | null
          program_key?: string | null
          program_slug?: string | null
          pte_min?: number | null
          publish_status?: string | null
          published?: boolean | null
          ranking_selection?: boolean | null
          required_documents?: Json | null
          requirements?: string[] | null
          requirements_text?: string | null
          scholarship_amount_usd?: number | null
          scholarship_covers_housing?: boolean | null
          scholarship_covers_insurance?: boolean | null
          scholarship_monthly_stipend_usd?: number | null
          scholarship_notes?: string | null
          scholarship_percent_coverage?: number | null
          scholarship_type?: string | null
          school_name?: string | null
          seats_available?: number | null
          seats_status?: string | null
          seats_total?: number | null
          selection_notes?: string | null
          source_program_url?: string | null
          study_mode?: string | null
          subject_area?: string | null
          teaching_language?: string | null
          title: string
          title_ar?: string | null
          toefl_min?: number | null
          toefl_required?: boolean | null
          tuition_basis?: string | null
          tuition_domestic?: number | null
          tuition_is_free?: boolean | null
          tuition_local_max?: number | null
          tuition_local_min?: number | null
          tuition_scope?: string | null
          tuition_usd_max?: number | null
          tuition_usd_min?: number | null
          tuition_yearly?: number | null
          university_id: string
          updated_at?: string | null
        }
        Update: {
          accepted_certificates?: string[] | null
          additional_requirements?: string | null
          admission_notes_text?: string | null
          admission_requirements_json?: Json | null
          application_deadline?: string | null
          application_fee?: number | null
          application_fee_currency?: string | null
          apply_url?: string | null
          aptitude_assessment_required?: boolean | null
          avg_salary?: number | null
          cefr_level?: string | null
          city?: string | null
          content_hash?: string | null
          created_at?: string | null
          currency_code?: string | null
          deadlines?: Json | null
          degree_id?: string | null
          degree_level?: string | null
          delivery_mode?: string | null
          description?: string | null
          discipline_id?: string | null
          duolingo_min?: number | null
          duration_months?: number | null
          ects_credits?: number | null
          employment_rate?: number | null
          enrolled_students?: number | null
          entrance_exam_required?: boolean | null
          entrance_exam_types?: string[] | null
          fee_exemption_rule?: string | null
          fee_rule_notes?: string | null
          fingerprint?: string | null
          foundation_required?: boolean | null
          gpa_min?: number | null
          gpa_required?: number | null
          has_internship?: boolean | null
          has_scholarship?: boolean | null
          has_scholarships?: boolean | null
          id?: string
          ielts_min_each_section?: number | null
          ielts_min_overall?: number | null
          ielts_required?: number | null
          image_url?: string | null
          intake_label?: string | null
          intake_months?: string[] | null
          interview_required?: boolean | null
          is_accredited?: boolean | null
          is_active?: boolean | null
          language?: string | null
          languages?: string[] | null
          multi_stage_selection?: boolean | null
          next_intake?: string | null
          next_intake_date?: string | null
          old_price?: number | null
          portfolio_required?: boolean | null
          prep_year_required?: boolean | null
          program_key?: string | null
          program_slug?: string | null
          pte_min?: number | null
          publish_status?: string | null
          published?: boolean | null
          ranking_selection?: boolean | null
          required_documents?: Json | null
          requirements?: string[] | null
          requirements_text?: string | null
          scholarship_amount_usd?: number | null
          scholarship_covers_housing?: boolean | null
          scholarship_covers_insurance?: boolean | null
          scholarship_monthly_stipend_usd?: number | null
          scholarship_notes?: string | null
          scholarship_percent_coverage?: number | null
          scholarship_type?: string | null
          school_name?: string | null
          seats_available?: number | null
          seats_status?: string | null
          seats_total?: number | null
          selection_notes?: string | null
          source_program_url?: string | null
          study_mode?: string | null
          subject_area?: string | null
          teaching_language?: string | null
          title?: string
          title_ar?: string | null
          toefl_min?: number | null
          toefl_required?: boolean | null
          tuition_basis?: string | null
          tuition_domestic?: number | null
          tuition_is_free?: boolean | null
          tuition_local_max?: number | null
          tuition_local_min?: number | null
          tuition_scope?: string | null
          tuition_usd_max?: number | null
          tuition_usd_min?: number | null
          tuition_yearly?: number | null
          university_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programs_degree_id_fkey"
            columns: ["degree_id"]
            isOneToOne: false
            referencedRelation: "degrees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "disciplines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      qs_acquisition_cursor: {
        Row: {
          consecutive_errors: number
          current_page: number
          id: string
          last_tick_at: string | null
          log: string[]
          max_consecutive_errors: number
          pages_per_tick: number
          pages_with_zero_entries: number
          phase: string
          profile_batch_size: number
          profile_cursor_position: number
          run_id: string | null
          started_at: string | null
          status: string
          tick_count: number
          total_entries: number
          total_pages_estimated: number | null
        }
        Insert: {
          consecutive_errors?: number
          current_page?: number
          id?: string
          last_tick_at?: string | null
          log?: string[]
          max_consecutive_errors?: number
          pages_per_tick?: number
          pages_with_zero_entries?: number
          phase?: string
          profile_batch_size?: number
          profile_cursor_position?: number
          run_id?: string | null
          started_at?: string | null
          status?: string
          tick_count?: number
          total_entries?: number
          total_pages_estimated?: number | null
        }
        Update: {
          consecutive_errors?: number
          current_page?: number
          id?: string
          last_tick_at?: string | null
          log?: string[]
          max_consecutive_errors?: number
          pages_per_tick?: number
          pages_with_zero_entries?: number
          phase?: string
          profile_batch_size?: number
          profile_cursor_position?: number
          run_id?: string | null
          started_at?: string | null
          status?: string
          tick_count?: number
          total_entries?: number
          total_pages_estimated?: number | null
        }
        Relationships: []
      }
      qs_admission_summaries: {
        Row: {
          admission_text: string | null
          entity_profile_id: string
          fetched_at: string | null
          id: string
          level: string
          test_scores: Json | null
        }
        Insert: {
          admission_text?: string | null
          entity_profile_id: string
          fetched_at?: string | null
          id?: string
          level: string
          test_scores?: Json | null
        }
        Update: {
          admission_text?: string | null
          entity_profile_id?: string
          fetched_at?: string | null
          id?: string
          level?: string
          test_scores?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "qs_admission_summaries_entity_profile_id_fkey"
            columns: ["entity_profile_id"]
            isOneToOne: false
            referencedRelation: "qs_entity_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      qs_campus_locations: {
        Row: {
          address: string | null
          campus_image_url: string | null
          campus_name: string | null
          city: string | null
          country_code: string | null
          entity_profile_id: string
          fetched_at: string | null
          id: string
          is_main: boolean | null
          map_link: string | null
          postal_code: string | null
        }
        Insert: {
          address?: string | null
          campus_image_url?: string | null
          campus_name?: string | null
          city?: string | null
          country_code?: string | null
          entity_profile_id: string
          fetched_at?: string | null
          id?: string
          is_main?: boolean | null
          map_link?: string | null
          postal_code?: string | null
        }
        Update: {
          address?: string | null
          campus_image_url?: string | null
          campus_name?: string | null
          city?: string | null
          country_code?: string | null
          entity_profile_id?: string
          fetched_at?: string | null
          id?: string
          is_main?: boolean | null
          map_link?: string | null
          postal_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qs_campus_locations_entity_profile_id_fkey"
            columns: ["entity_profile_id"]
            isOneToOne: false
            referencedRelation: "qs_entity_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      qs_cost_of_living: {
        Row: {
          accommodation_amount: number | null
          cost_of_living_text: string | null
          currency: string | null
          entity_profile_id: string
          fetched_at: string | null
          food_amount: number | null
          id: string
          is_approx: boolean | null
          raw_text: string | null
          transport_amount: number | null
          utilities_amount: number | null
        }
        Insert: {
          accommodation_amount?: number | null
          cost_of_living_text?: string | null
          currency?: string | null
          entity_profile_id: string
          fetched_at?: string | null
          food_amount?: number | null
          id?: string
          is_approx?: boolean | null
          raw_text?: string | null
          transport_amount?: number | null
          utilities_amount?: number | null
        }
        Update: {
          accommodation_amount?: number | null
          cost_of_living_text?: string | null
          currency?: string | null
          entity_profile_id?: string
          fetched_at?: string | null
          food_amount?: number | null
          id?: string
          is_approx?: boolean | null
          raw_text?: string | null
          transport_amount?: number | null
          utilities_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "qs_cost_of_living_entity_profile_id_fkey"
            columns: ["entity_profile_id"]
            isOneToOne: true
            referencedRelation: "qs_entity_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      qs_employability: {
        Row: {
          career_services_text: string | null
          entity_profile_id: string
          fetched_at: string | null
          id: string
          service_list: string[] | null
        }
        Insert: {
          career_services_text?: string | null
          entity_profile_id: string
          fetched_at?: string | null
          id?: string
          service_list?: string[] | null
        }
        Update: {
          career_services_text?: string | null
          entity_profile_id?: string
          fetched_at?: string | null
          id?: string
          service_list?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "qs_employability_entity_profile_id_fkey"
            columns: ["entity_profile_id"]
            isOneToOne: true
            referencedRelation: "qs_entity_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      qs_entity_profiles: {
        Row: {
          about_text: string | null
          canonical_university_id: string | null
          city: string | null
          country: string | null
          created_at: string | null
          entity_type: string
          fetched_at: string | null
          id: string
          institution_type: string | null
          name: string
          official_website: string | null
          parent_entity_id: string | null
          profile_tier: string | null
          programme_count_qs: number | null
          qs_slug: string
          qs_url: string
          raw_snapshot_id: string | null
          slug_source: string | null
          slug_verified_at: string | null
          social_links: Json | null
          university_id: string | null
        }
        Insert: {
          about_text?: string | null
          canonical_university_id?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          entity_type?: string
          fetched_at?: string | null
          id?: string
          institution_type?: string | null
          name: string
          official_website?: string | null
          parent_entity_id?: string | null
          profile_tier?: string | null
          programme_count_qs?: number | null
          qs_slug: string
          qs_url: string
          raw_snapshot_id?: string | null
          slug_source?: string | null
          slug_verified_at?: string | null
          social_links?: Json | null
          university_id?: string | null
        }
        Update: {
          about_text?: string | null
          canonical_university_id?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          entity_type?: string
          fetched_at?: string | null
          id?: string
          institution_type?: string | null
          name?: string
          official_website?: string | null
          parent_entity_id?: string | null
          profile_tier?: string | null
          programme_count_qs?: number | null
          qs_slug?: string
          qs_url?: string
          raw_snapshot_id?: string | null
          slug_source?: string | null
          slug_verified_at?: string | null
          social_links?: Json | null
          university_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qs_entity_profiles_canonical_university_id_fkey"
            columns: ["canonical_university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "qs_entity_profiles_canonical_university_id_fkey"
            columns: ["canonical_university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "qs_entity_profiles_canonical_university_id_fkey"
            columns: ["canonical_university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qs_entity_profiles_canonical_university_id_fkey"
            columns: ["canonical_university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "qs_entity_profiles_canonical_university_id_fkey"
            columns: ["canonical_university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "qs_entity_profiles_canonical_university_id_fkey"
            columns: ["canonical_university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "qs_entity_profiles_canonical_university_id_fkey"
            columns: ["canonical_university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "qs_entity_profiles_canonical_university_id_fkey"
            columns: ["canonical_university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "qs_entity_profiles_canonical_university_id_fkey"
            columns: ["canonical_university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qs_entity_profiles_canonical_university_id_fkey"
            columns: ["canonical_university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "qs_entity_profiles_canonical_university_id_fkey"
            columns: ["canonical_university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "qs_entity_profiles_canonical_university_id_fkey"
            columns: ["canonical_university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qs_entity_profiles_parent_entity_id_fkey"
            columns: ["parent_entity_id"]
            isOneToOne: false
            referencedRelation: "qs_entity_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qs_entity_profiles_raw_snapshot_id_fkey"
            columns: ["raw_snapshot_id"]
            isOneToOne: false
            referencedRelation: "crawl_raw_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qs_entity_profiles_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "qs_entity_profiles_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "qs_entity_profiles_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qs_entity_profiles_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "qs_entity_profiles_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "qs_entity_profiles_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "qs_entity_profiles_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "qs_entity_profiles_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "qs_entity_profiles_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qs_entity_profiles_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "qs_entity_profiles_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "qs_entity_profiles_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      qs_facilities: {
        Row: {
          entity_profile_id: string
          facilities_text: string | null
          fetched_at: string | null
          id: string
        }
        Insert: {
          entity_profile_id: string
          facilities_text?: string | null
          fetched_at?: string | null
          id?: string
        }
        Update: {
          entity_profile_id?: string
          facilities_text?: string | null
          fetched_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qs_facilities_entity_profile_id_fkey"
            columns: ["entity_profile_id"]
            isOneToOne: true
            referencedRelation: "qs_entity_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      qs_faqs: {
        Row: {
          answer: string | null
          entity_profile_id: string
          fetched_at: string | null
          id: string
          question: string
          source_links: string[] | null
        }
        Insert: {
          answer?: string | null
          entity_profile_id: string
          fetched_at?: string | null
          id?: string
          question: string
          source_links?: string[] | null
        }
        Update: {
          answer?: string | null
          entity_profile_id?: string
          fetched_at?: string | null
          id?: string
          question?: string
          source_links?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "qs_faqs_entity_profile_id_fkey"
            columns: ["entity_profile_id"]
            isOneToOne: false
            referencedRelation: "qs_entity_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      qs_media_assets: {
        Row: {
          brochure_links: string[] | null
          cover_image_url: string | null
          entity_profile_id: string
          fetched_at: string | null
          gallery_present: boolean | null
          id: string
          logo_url: string | null
          map_present: boolean | null
          photo_assets: string[] | null
          video_assets: Json | null
        }
        Insert: {
          brochure_links?: string[] | null
          cover_image_url?: string | null
          entity_profile_id: string
          fetched_at?: string | null
          gallery_present?: boolean | null
          id?: string
          logo_url?: string | null
          map_present?: boolean | null
          photo_assets?: string[] | null
          video_assets?: Json | null
        }
        Update: {
          brochure_links?: string[] | null
          cover_image_url?: string | null
          entity_profile_id?: string
          fetched_at?: string | null
          gallery_present?: boolean | null
          id?: string
          logo_url?: string | null
          map_present?: boolean | null
          photo_assets?: string[] | null
          video_assets?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "qs_media_assets_entity_profile_id_fkey"
            columns: ["entity_profile_id"]
            isOneToOne: true
            referencedRelation: "qs_entity_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      qs_page_entries: {
        Row: {
          acquisition_run_id: string
          crawl_status: string
          discovered_at: string
          discovery_method: string
          display_name: string
          duplicate_of_slug: string | null
          entity_type: string
          global_position: number
          id: string
          is_duplicate_seen: boolean
          last_seen_at: string
          linked_at: string | null
          match_confidence: number | null
          match_method: string | null
          matched_university_id: string | null
          page_number: number
          position_on_page: number
          profile_attempts: number
          profile_error: string | null
          profile_fetched_at: string | null
          profile_run_id: string | null
          profile_snapshot_id: string | null
          qs_slug: string
          rank_normalized: number | null
          rank_raw: string
          rank_source: string
          results_per_page_observed: number | null
          sort_position: number | null
          source: string
          source_profile_url: string
          trace_id: string | null
        }
        Insert: {
          acquisition_run_id: string
          crawl_status?: string
          discovered_at?: string
          discovery_method?: string
          display_name: string
          duplicate_of_slug?: string | null
          entity_type?: string
          global_position: number
          id?: string
          is_duplicate_seen?: boolean
          last_seen_at?: string
          linked_at?: string | null
          match_confidence?: number | null
          match_method?: string | null
          matched_university_id?: string | null
          page_number: number
          position_on_page: number
          profile_attempts?: number
          profile_error?: string | null
          profile_fetched_at?: string | null
          profile_run_id?: string | null
          profile_snapshot_id?: string | null
          qs_slug: string
          rank_normalized?: number | null
          rank_raw: string
          rank_source?: string
          results_per_page_observed?: number | null
          sort_position?: number | null
          source?: string
          source_profile_url: string
          trace_id?: string | null
        }
        Update: {
          acquisition_run_id?: string
          crawl_status?: string
          discovered_at?: string
          discovery_method?: string
          display_name?: string
          duplicate_of_slug?: string | null
          entity_type?: string
          global_position?: number
          id?: string
          is_duplicate_seen?: boolean
          last_seen_at?: string
          linked_at?: string | null
          match_confidence?: number | null
          match_method?: string | null
          matched_university_id?: string | null
          page_number?: number
          position_on_page?: number
          profile_attempts?: number
          profile_error?: string | null
          profile_fetched_at?: string | null
          profile_run_id?: string | null
          profile_snapshot_id?: string | null
          qs_slug?: string
          rank_normalized?: number | null
          rank_raw?: string
          rank_source?: string
          results_per_page_observed?: number | null
          sort_position?: number | null
          source?: string
          source_profile_url?: string
          trace_id?: string | null
        }
        Relationships: []
      }
      qs_page_proofs: {
        Row: {
          acquisition_run_id: string
          entry_count: number
          fetch_duration_ms: number | null
          fetched_at: string
          first_rank_normalized: number | null
          first_rank_raw: string | null
          first_slug: string | null
          has_next_page: boolean | null
          id: string
          is_valid: boolean
          last_rank_normalized: number | null
          last_rank_raw: string | null
          last_slug: string | null
          markdown_length: number
          page_number: number
          page_url: string
          parse_warnings: string[] | null
          results_per_page_observed: number | null
          shell_reason: string | null
          snapshot_id: string | null
          trace_id: string | null
          valid_rank_count: number
        }
        Insert: {
          acquisition_run_id: string
          entry_count?: number
          fetch_duration_ms?: number | null
          fetched_at?: string
          first_rank_normalized?: number | null
          first_rank_raw?: string | null
          first_slug?: string | null
          has_next_page?: boolean | null
          id?: string
          is_valid?: boolean
          last_rank_normalized?: number | null
          last_rank_raw?: string | null
          last_slug?: string | null
          markdown_length?: number
          page_number: number
          page_url: string
          parse_warnings?: string[] | null
          results_per_page_observed?: number | null
          shell_reason?: string | null
          snapshot_id?: string | null
          trace_id?: string | null
          valid_rank_count?: number
        }
        Update: {
          acquisition_run_id?: string
          entry_count?: number
          fetch_duration_ms?: number | null
          fetched_at?: string
          first_rank_normalized?: number | null
          first_rank_raw?: string | null
          first_slug?: string | null
          has_next_page?: boolean | null
          id?: string
          is_valid?: boolean
          last_rank_normalized?: number | null
          last_rank_raw?: string | null
          last_slug?: string | null
          markdown_length?: number
          page_number?: number
          page_url?: string
          parse_warnings?: string[] | null
          results_per_page_observed?: number | null
          shell_reason?: string | null
          snapshot_id?: string | null
          trace_id?: string | null
          valid_rank_count?: number
        }
        Relationships: []
      }
      qs_programme_details: {
        Row: {
          admission_requirements: Json | null
          deadline_confidence: string | null
          deadline_raw: string | null
          deadlines_jsonb: Json | null
          degree: string | null
          duration: string | null
          entity_profile_id: string
          fetched_at: string | null
          id: string
          level: string | null
          programme_url: string
          raw_snapshot_id: string | null
          school_name: string | null
          start_months: string[] | null
          study_mode: string | null
          subject_area: string | null
          title: string | null
          tuition_currency: string | null
          tuition_domestic: number | null
          tuition_international: number | null
        }
        Insert: {
          admission_requirements?: Json | null
          deadline_confidence?: string | null
          deadline_raw?: string | null
          deadlines_jsonb?: Json | null
          degree?: string | null
          duration?: string | null
          entity_profile_id: string
          fetched_at?: string | null
          id?: string
          level?: string | null
          programme_url: string
          raw_snapshot_id?: string | null
          school_name?: string | null
          start_months?: string[] | null
          study_mode?: string | null
          subject_area?: string | null
          title?: string | null
          tuition_currency?: string | null
          tuition_domestic?: number | null
          tuition_international?: number | null
        }
        Update: {
          admission_requirements?: Json | null
          deadline_confidence?: string | null
          deadline_raw?: string | null
          deadlines_jsonb?: Json | null
          degree?: string | null
          duration?: string | null
          entity_profile_id?: string
          fetched_at?: string | null
          id?: string
          level?: string | null
          programme_url?: string
          raw_snapshot_id?: string | null
          school_name?: string | null
          start_months?: string[] | null
          study_mode?: string | null
          subject_area?: string | null
          title?: string | null
          tuition_currency?: string | null
          tuition_domestic?: number | null
          tuition_international?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "qs_programme_details_entity_profile_id_fkey"
            columns: ["entity_profile_id"]
            isOneToOne: false
            referencedRelation: "qs_entity_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qs_programme_details_raw_snapshot_id_fkey"
            columns: ["raw_snapshot_id"]
            isOneToOne: false
            referencedRelation: "crawl_raw_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      qs_programme_directory_audit: {
        Row: {
          audit_status: string | null
          audited_at: string | null
          directory_programme_count: number | null
          entity_profile_id: string
          id: string
          missing_programmes: string[] | null
          profile_programme_count: number | null
          stored_drafts_count: number | null
          surplus_programmes: string[] | null
        }
        Insert: {
          audit_status?: string | null
          audited_at?: string | null
          directory_programme_count?: number | null
          entity_profile_id: string
          id?: string
          missing_programmes?: string[] | null
          profile_programme_count?: number | null
          stored_drafts_count?: number | null
          surplus_programmes?: string[] | null
        }
        Update: {
          audit_status?: string | null
          audited_at?: string | null
          directory_programme_count?: number | null
          entity_profile_id?: string
          id?: string
          missing_programmes?: string[] | null
          profile_programme_count?: number | null
          stored_drafts_count?: number | null
          surplus_programmes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "qs_programme_directory_audit_entity_profile_id_fkey"
            columns: ["entity_profile_id"]
            isOneToOne: false
            referencedRelation: "qs_entity_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      qs_programme_entries: {
        Row: {
          crawl_run_id: string | null
          crawl_status: string
          created_at: string | null
          degree: string | null
          discovery_run_id: string | null
          entity_profile_id: string | null
          error: string | null
          fetch_attempts: number | null
          fetched_at: string | null
          id: string
          level: string | null
          programme_url: string
          qs_slug: string
          snapshot_id: string | null
          title: string | null
        }
        Insert: {
          crawl_run_id?: string | null
          crawl_status?: string
          created_at?: string | null
          degree?: string | null
          discovery_run_id?: string | null
          entity_profile_id?: string | null
          error?: string | null
          fetch_attempts?: number | null
          fetched_at?: string | null
          id?: string
          level?: string | null
          programme_url: string
          qs_slug: string
          snapshot_id?: string | null
          title?: string | null
        }
        Update: {
          crawl_run_id?: string | null
          crawl_status?: string
          created_at?: string | null
          degree?: string | null
          discovery_run_id?: string | null
          entity_profile_id?: string | null
          error?: string | null
          fetch_attempts?: number | null
          fetched_at?: string | null
          id?: string
          level?: string | null
          programme_url?: string
          qs_slug?: string
          snapshot_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qs_programme_entries_entity_profile_id_fkey"
            columns: ["entity_profile_id"]
            isOneToOne: false
            referencedRelation: "qs_entity_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qs_programme_entries_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "crawl_raw_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      qs_ranking_snapshots: {
        Row: {
          entity_profile_id: string
          fetched_at: string | null
          id: string
          indicators: Json | null
          overall_score: number | null
          ranking_history: Json | null
          ranking_year: number
          regional_rank: number | null
          subject_rankings: Json | null
          sustainability_rank: number | null
          world_rank: number | null
        }
        Insert: {
          entity_profile_id: string
          fetched_at?: string | null
          id?: string
          indicators?: Json | null
          overall_score?: number | null
          ranking_history?: Json | null
          ranking_year: number
          regional_rank?: number | null
          subject_rankings?: Json | null
          sustainability_rank?: number | null
          world_rank?: number | null
        }
        Update: {
          entity_profile_id?: string
          fetched_at?: string | null
          id?: string
          indicators?: Json | null
          overall_score?: number | null
          ranking_history?: Json | null
          ranking_year?: number
          regional_rank?: number | null
          subject_rankings?: Json | null
          sustainability_rank?: number | null
          world_rank?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "qs_ranking_snapshots_entity_profile_id_fkey"
            columns: ["entity_profile_id"]
            isOneToOne: false
            referencedRelation: "qs_entity_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      qs_section_observations: {
        Row: {
          crawl_run_id: string | null
          data_sample: Json | null
          entity_profile_id: string
          id: string
          ignore_reason: string | null
          observed_at: string | null
          quarantine_reason: string | null
          section_name: string
          status: string
        }
        Insert: {
          crawl_run_id?: string | null
          data_sample?: Json | null
          entity_profile_id: string
          id?: string
          ignore_reason?: string | null
          observed_at?: string | null
          quarantine_reason?: string | null
          section_name: string
          status: string
        }
        Update: {
          crawl_run_id?: string | null
          data_sample?: Json | null
          entity_profile_id?: string
          id?: string
          ignore_reason?: string | null
          observed_at?: string | null
          quarantine_reason?: string | null
          section_name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "qs_section_observations_entity_profile_id_fkey"
            columns: ["entity_profile_id"]
            isOneToOne: false
            referencedRelation: "qs_entity_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      qs_similar_entities: {
        Row: {
          entity_profile_id: string
          fetched_at: string | null
          id: string
          similar_name: string | null
          similar_qs_slug: string
          similar_url: string | null
          similarity_context: string | null
        }
        Insert: {
          entity_profile_id: string
          fetched_at?: string | null
          id?: string
          similar_name?: string | null
          similar_qs_slug: string
          similar_url?: string | null
          similarity_context?: string | null
        }
        Update: {
          entity_profile_id?: string
          fetched_at?: string | null
          id?: string
          similar_name?: string | null
          similar_qs_slug?: string
          similar_url?: string | null
          similarity_context?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qs_similar_entities_entity_profile_id_fkey"
            columns: ["entity_profile_id"]
            isOneToOne: false
            referencedRelation: "qs_entity_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      qs_slug_staging: {
        Row: {
          discovered_at: string | null
          match_confidence: number | null
          match_reason: string | null
          match_status: string | null
          match_university_id: string | null
          slug: string
          source_url: string
        }
        Insert: {
          discovered_at?: string | null
          match_confidence?: number | null
          match_reason?: string | null
          match_status?: string | null
          match_university_id?: string | null
          slug: string
          source_url: string
        }
        Update: {
          discovered_at?: string | null
          match_confidence?: number | null
          match_reason?: string | null
          match_status?: string | null
          match_university_id?: string | null
          slug?: string
          source_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "qs_slug_staging_match_university_id_fkey"
            columns: ["match_university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "qs_slug_staging_match_university_id_fkey"
            columns: ["match_university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "qs_slug_staging_match_university_id_fkey"
            columns: ["match_university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qs_slug_staging_match_university_id_fkey"
            columns: ["match_university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "qs_slug_staging_match_university_id_fkey"
            columns: ["match_university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "qs_slug_staging_match_university_id_fkey"
            columns: ["match_university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "qs_slug_staging_match_university_id_fkey"
            columns: ["match_university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "qs_slug_staging_match_university_id_fkey"
            columns: ["match_university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "qs_slug_staging_match_university_id_fkey"
            columns: ["match_university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qs_slug_staging_match_university_id_fkey"
            columns: ["match_university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "qs_slug_staging_match_university_id_fkey"
            columns: ["match_university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "qs_slug_staging_match_university_id_fkey"
            columns: ["match_university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      qs_student_life: {
        Row: {
          clubs_societies: string[] | null
          counselling_available: boolean | null
          dorms_available: boolean | null
          entity_profile_id: string
          fetched_at: string | null
          id: string
          student_life_text: string | null
        }
        Insert: {
          clubs_societies?: string[] | null
          counselling_available?: boolean | null
          dorms_available?: boolean | null
          entity_profile_id: string
          fetched_at?: string | null
          id?: string
          student_life_text?: string | null
        }
        Update: {
          clubs_societies?: string[] | null
          counselling_available?: boolean | null
          dorms_available?: boolean | null
          entity_profile_id?: string
          fetched_at?: string | null
          id?: string
          student_life_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qs_student_life_entity_profile_id_fkey"
            columns: ["entity_profile_id"]
            isOneToOne: true
            referencedRelation: "qs_entity_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      qs_students_staff: {
        Row: {
          domestic_staff_pct: number | null
          entity_profile_id: string
          fetched_at: string | null
          id: string
          intl_pg_pct: number | null
          intl_staff_pct: number | null
          intl_students: number | null
          intl_ug_pct: number | null
          pg_pct: number | null
          total_faculty: number | null
          total_students: number | null
          ug_pct: number | null
        }
        Insert: {
          domestic_staff_pct?: number | null
          entity_profile_id: string
          fetched_at?: string | null
          id?: string
          intl_pg_pct?: number | null
          intl_staff_pct?: number | null
          intl_students?: number | null
          intl_ug_pct?: number | null
          pg_pct?: number | null
          total_faculty?: number | null
          total_students?: number | null
          ug_pct?: number | null
        }
        Update: {
          domestic_staff_pct?: number | null
          entity_profile_id?: string
          fetched_at?: string | null
          id?: string
          intl_pg_pct?: number | null
          intl_staff_pct?: number | null
          intl_students?: number | null
          intl_ug_pct?: number | null
          pg_pct?: number | null
          total_faculty?: number | null
          total_students?: number | null
          ug_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "qs_students_staff_entity_profile_id_fkey"
            columns: ["entity_profile_id"]
            isOneToOne: true
            referencedRelation: "qs_entity_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          domain: string
          endpoint: string | null
          id: number
          last_request_at: string
          requests_count: number
          window_start: string
        }
        Insert: {
          domain: string
          endpoint?: string | null
          id?: number
          last_request_at?: string
          requests_count?: number
          window_start?: string
        }
        Update: {
          domain?: string
          endpoint?: string | null
          id?: number
          last_request_at?: string
          requests_count?: number
          window_start?: string
        }
        Relationships: []
      }
      raw_pages: {
        Row: {
          body_sha256: string | null
          content_type: string | null
          etag: string | null
          fetch_attempts: number | null
          fetch_error: string | null
          fetched_at: string | null
          id: number
          last_modified: string | null
          needs_render: boolean | null
          page_type: string | null
          parser_version: string | null
          source_name: string | null
          status_code: number | null
          text_content: string | null
          trace_id: string | null
          university_id: string | null
          url: string
        }
        Insert: {
          body_sha256?: string | null
          content_type?: string | null
          etag?: string | null
          fetch_attempts?: number | null
          fetch_error?: string | null
          fetched_at?: string | null
          id?: number
          last_modified?: string | null
          needs_render?: boolean | null
          page_type?: string | null
          parser_version?: string | null
          source_name?: string | null
          status_code?: number | null
          text_content?: string | null
          trace_id?: string | null
          university_id?: string | null
          url: string
        }
        Update: {
          body_sha256?: string | null
          content_type?: string | null
          etag?: string | null
          fetch_attempts?: number | null
          fetch_error?: string | null
          fetched_at?: string | null
          id?: number
          last_modified?: string | null
          needs_render?: boolean | null
          page_type?: string | null
          parser_version?: string | null
          source_name?: string | null
          status_code?: number | null
          text_content?: string | null
          trace_id?: string | null
          university_id?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_pages_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "raw_pages_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "raw_pages_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_pages_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "raw_pages_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "raw_pages_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "raw_pages_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "raw_pages_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "raw_pages_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_pages_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "raw_pages_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "raw_pages_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations_cache: {
        Row: {
          created_at: string | null
          id: string
          program_id: string
          reasons: Json | null
          score: number
          user_id: string | null
          visitor_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          program_id: string
          reasons?: Json | null
          score: number
          user_id?: string | null
          visitor_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          program_id?: string
          reasons?: Json | null
          score?: number
          user_id?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      requirement_catalog: {
        Row: {
          created_at: string
          display_name_i18n: Json
          is_active: boolean
          parameters_schema: Json
          requirement_code: string
          requirement_type: string
        }
        Insert: {
          created_at?: string
          display_name_i18n?: Json
          is_active?: boolean
          parameters_schema?: Json
          requirement_code: string
          requirement_type: string
        }
        Update: {
          created_at?: string
          display_name_i18n?: Json
          is_active?: boolean
          parameters_schema?: Json
          requirement_code?: string
          requirement_type?: string
        }
        Relationships: []
      }
      russian_assessment_attempts: {
        Row: {
          answers_json: Json
          assessment_template_id: string
          attempt_no: number
          course_id: string
          created_at: string
          dimension_scores_json: Json
          duration_seconds: number
          feedback_json: Json
          id: string
          learner_readiness_profile_id: string | null
          passed: boolean | null
          percent_score: number
          score: number
          section_scores_json: Json
          status: string
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answers_json?: Json
          assessment_template_id: string
          attempt_no?: number
          course_id: string
          created_at?: string
          dimension_scores_json?: Json
          duration_seconds?: number
          feedback_json?: Json
          id?: string
          learner_readiness_profile_id?: string | null
          passed?: boolean | null
          percent_score?: number
          score?: number
          section_scores_json?: Json
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answers_json?: Json
          assessment_template_id?: string
          attempt_no?: number
          course_id?: string
          created_at?: string
          dimension_scores_json?: Json
          duration_seconds?: number
          feedback_json?: Json
          id?: string
          learner_readiness_profile_id?: string | null
          passed?: boolean | null
          percent_score?: number
          score?: number
          section_scores_json?: Json
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "russian_assessment_attempts_assessment_template_id_fkey"
            columns: ["assessment_template_id"]
            isOneToOne: false
            referencedRelation: "russian_assessment_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "russian_assessment_attempts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "russian_learning_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "russian_assessment_attempts_learner_readiness_profile_id_fkey"
            columns: ["learner_readiness_profile_id"]
            isOneToOne: false
            referencedRelation: "russian_learner_readiness_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      russian_assessment_templates: {
        Row: {
          blueprint_json: Json
          checkpoint_family_key: string | null
          course_id: string
          created_at: string
          description: string | null
          id: string
          lesson_scope_keys: string[]
          metadata: Json
          module_scope_keys: string[]
          passing_score: number | null
          scoring_json: Json
          template_key: string
          template_type: string
          title: string
          total_items: number
          track_scope: string
          updated_at: string
          version: string
        }
        Insert: {
          blueprint_json?: Json
          checkpoint_family_key?: string | null
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          lesson_scope_keys?: string[]
          metadata?: Json
          module_scope_keys?: string[]
          passing_score?: number | null
          scoring_json?: Json
          template_key: string
          template_type: string
          title: string
          total_items?: number
          track_scope?: string
          updated_at?: string
          version?: string
        }
        Update: {
          blueprint_json?: Json
          checkpoint_family_key?: string | null
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          lesson_scope_keys?: string[]
          metadata?: Json
          module_scope_keys?: string[]
          passing_score?: number | null
          scoring_json?: Json
          template_key?: string
          template_type?: string
          title?: string
          total_items?: number
          track_scope?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "russian_assessment_templates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "russian_learning_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      russian_exam_attempts: {
        Row: {
          answers_json: Json
          attempt_no: number
          course_id: string
          created_at: string
          duration_seconds: number
          exam_set_id: string
          feedback_json: Json
          id: string
          learner_readiness_profile_id: string | null
          passed: boolean | null
          percent_score: number
          readiness_band: string | null
          review_json: Json
          score: number
          section_scores_json: Json
          status: string
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answers_json?: Json
          attempt_no?: number
          course_id: string
          created_at?: string
          duration_seconds?: number
          exam_set_id: string
          feedback_json?: Json
          id?: string
          learner_readiness_profile_id?: string | null
          passed?: boolean | null
          percent_score?: number
          readiness_band?: string | null
          review_json?: Json
          score?: number
          section_scores_json?: Json
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answers_json?: Json
          attempt_no?: number
          course_id?: string
          created_at?: string
          duration_seconds?: number
          exam_set_id?: string
          feedback_json?: Json
          id?: string
          learner_readiness_profile_id?: string | null
          passed?: boolean | null
          percent_score?: number
          readiness_band?: string | null
          review_json?: Json
          score?: number
          section_scores_json?: Json
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "russian_exam_attempts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "russian_learning_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "russian_exam_attempts_exam_set_id_fkey"
            columns: ["exam_set_id"]
            isOneToOne: false
            referencedRelation: "russian_exam_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "russian_exam_attempts_learner_readiness_profile_id_fkey"
            columns: ["learner_readiness_profile_id"]
            isOneToOne: false
            referencedRelation: "russian_learner_readiness_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      russian_exam_sets: {
        Row: {
          blueprint_json: Json
          course_id: string
          created_at: string
          exam_family: string
          exam_set_key: string
          id: string
          lesson_scope_keys: string[]
          metadata: Json
          module_scope_keys: string[]
          release_stage: string
          target_score: number | null
          title: string
          total_items: number
          total_sections: number
          track_scope: string
          updated_at: string
          version: string
        }
        Insert: {
          blueprint_json?: Json
          course_id: string
          created_at?: string
          exam_family: string
          exam_set_key: string
          id?: string
          lesson_scope_keys?: string[]
          metadata?: Json
          module_scope_keys?: string[]
          release_stage?: string
          target_score?: number | null
          title: string
          total_items?: number
          total_sections?: number
          track_scope?: string
          updated_at?: string
          version?: string
        }
        Update: {
          blueprint_json?: Json
          course_id?: string
          created_at?: string
          exam_family?: string
          exam_set_key?: string
          id?: string
          lesson_scope_keys?: string[]
          metadata?: Json
          module_scope_keys?: string[]
          release_stage?: string
          target_score?: number | null
          title?: string
          total_items?: number
          total_sections?: number
          track_scope?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "russian_exam_sets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "russian_learning_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      russian_intensive_review_states: {
        Row: {
          blocking_reasons: string[]
          course_id: string
          created_at: string
          id: string
          metadata_json: Json
          resolved_at: string | null
          review_block_ids: string[]
          review_status: string
          source_exam_attempt_id: string | null
          source_exam_key: string
          stage_key: string
          updated_at: string
          user_id: string
          weak_area_keys: string[]
          week_number: number
        }
        Insert: {
          blocking_reasons?: string[]
          course_id: string
          created_at?: string
          id?: string
          metadata_json?: Json
          resolved_at?: string | null
          review_block_ids?: string[]
          review_status?: string
          source_exam_attempt_id?: string | null
          source_exam_key: string
          stage_key: string
          updated_at?: string
          user_id: string
          weak_area_keys?: string[]
          week_number: number
        }
        Update: {
          blocking_reasons?: string[]
          course_id?: string
          created_at?: string
          id?: string
          metadata_json?: Json
          resolved_at?: string | null
          review_block_ids?: string[]
          review_status?: string
          source_exam_attempt_id?: string | null
          source_exam_key?: string
          stage_key?: string
          updated_at?: string
          user_id?: string
          weak_area_keys?: string[]
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "russian_intensive_review_states_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "russian_learning_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "russian_intensive_review_states_source_exam_attempt_id_fkey"
            columns: ["source_exam_attempt_id"]
            isOneToOne: false
            referencedRelation: "russian_exam_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      russian_learner_readiness_profiles: {
        Row: {
          academic_core_score: number
          calculated_at: string
          course_id: string
          created_at: string
          current_cefr_band: string | null
          dimensions_json: Json
          discipline_overlay_score: number
          enrollment_id: string | null
          exam_readiness_score: number
          id: string
          latest_checkpoint_attempt_id: string | null
          latest_exam_attempt_id: string | null
          overall_readiness_score: number
          placement_result_id: string | null
          profile_status: string
          readiness_band: string
          recommendations_json: Json
          shared_foundation_score: number
          snapshot_version: string
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_core_score?: number
          calculated_at?: string
          course_id: string
          created_at?: string
          current_cefr_band?: string | null
          dimensions_json?: Json
          discipline_overlay_score?: number
          enrollment_id?: string | null
          exam_readiness_score?: number
          id?: string
          latest_checkpoint_attempt_id?: string | null
          latest_exam_attempt_id?: string | null
          overall_readiness_score?: number
          placement_result_id?: string | null
          profile_status?: string
          readiness_band?: string
          recommendations_json?: Json
          shared_foundation_score?: number
          snapshot_version?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_core_score?: number
          calculated_at?: string
          course_id?: string
          created_at?: string
          current_cefr_band?: string | null
          dimensions_json?: Json
          discipline_overlay_score?: number
          enrollment_id?: string | null
          exam_readiness_score?: number
          id?: string
          latest_checkpoint_attempt_id?: string | null
          latest_exam_attempt_id?: string | null
          overall_readiness_score?: number
          placement_result_id?: string | null
          profile_status?: string
          readiness_band?: string
          recommendations_json?: Json
          shared_foundation_score?: number
          snapshot_version?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_readiness_profiles_latest_checkpoint_attempt_id_fkey"
            columns: ["latest_checkpoint_attempt_id"]
            isOneToOne: false
            referencedRelation: "russian_assessment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_readiness_profiles_latest_exam_attempt_id_fkey"
            columns: ["latest_exam_attempt_id"]
            isOneToOne: false
            referencedRelation: "russian_exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_readiness_profiles_placement_result_id_fkey"
            columns: ["placement_result_id"]
            isOneToOne: false
            referencedRelation: "russian_placement_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "russian_learner_readiness_profiles_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "russian_learning_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "russian_learner_readiness_profiles_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "learning_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      russian_learner_unlocks: {
        Row: {
          assessment_template_id: string | null
          course_id: string
          created_at: string
          exam_set_id: string | null
          expires_at: string | null
          id: string
          lesson_id: string | null
          module_id: string | null
          source_ref_id: string | null
          unlock_source: string
          unlock_type: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          assessment_template_id?: string | null
          course_id: string
          created_at?: string
          exam_set_id?: string | null
          expires_at?: string | null
          id?: string
          lesson_id?: string | null
          module_id?: string | null
          source_ref_id?: string | null
          unlock_source: string
          unlock_type: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          assessment_template_id?: string | null
          course_id?: string
          created_at?: string
          exam_set_id?: string | null
          expires_at?: string | null
          id?: string
          lesson_id?: string | null
          module_id?: string | null
          source_ref_id?: string | null
          unlock_source?: string
          unlock_type?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_unlocks_assessment_template_id_fkey"
            columns: ["assessment_template_id"]
            isOneToOne: false
            referencedRelation: "russian_assessment_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_unlocks_exam_set_id_fkey"
            columns: ["exam_set_id"]
            isOneToOne: false
            referencedRelation: "russian_exam_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "russian_learner_unlocks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "russian_learning_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "russian_learner_unlocks_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "russian_learning_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "russian_learner_unlocks_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "russian_learning_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      russian_learning_courses: {
        Row: {
          academic_track: string
          course_key: string
          created_at: string
          dashboard_enabled: boolean
          delivery_mode: string
          description: string | null
          goal_type: string
          id: string
          language_code: string
          metadata: Json
          placement_required: boolean
          readiness_profile_enabled: boolean
          sort_order: number
          title: string
          updated_at: string
          version: string
          visibility: string
        }
        Insert: {
          academic_track?: string
          course_key: string
          created_at?: string
          dashboard_enabled?: boolean
          delivery_mode?: string
          description?: string | null
          goal_type: string
          id?: string
          language_code?: string
          metadata?: Json
          placement_required?: boolean
          readiness_profile_enabled?: boolean
          sort_order?: number
          title: string
          updated_at?: string
          version?: string
          visibility?: string
        }
        Update: {
          academic_track?: string
          course_key?: string
          created_at?: string
          dashboard_enabled?: boolean
          delivery_mode?: string
          description?: string | null
          goal_type?: string
          id?: string
          language_code?: string
          metadata?: Json
          placement_required?: boolean
          readiness_profile_enabled?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
          version?: string
          visibility?: string
        }
        Relationships: []
      }
      russian_learning_lesson_sections: {
        Row: {
          content_json: Json
          created_at: string
          estimated_minutes: number
          id: string
          is_required: boolean
          lesson_id: string
          mastery_gate: Json
          ordinal: number
          section_key: string
          section_type: string
          title: string | null
          updated_at: string
        }
        Insert: {
          content_json?: Json
          created_at?: string
          estimated_minutes?: number
          id?: string
          is_required?: boolean
          lesson_id: string
          mastery_gate?: Json
          ordinal: number
          section_key: string
          section_type: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          content_json?: Json
          created_at?: string
          estimated_minutes?: number
          id?: string
          is_required?: boolean
          lesson_id?: string
          mastery_gate?: Json
          ordinal?: number
          section_key?: string
          section_type?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "russian_learning_lesson_sections_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "russian_learning_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      russian_learning_lessons: {
        Row: {
          checkpoint_family_key: string | null
          created_at: string
          estimated_minutes: number
          id: string
          lesson_key: string
          lesson_type: string
          metadata: Json
          module_id: string
          ordinal: number
          readiness_weight: number
          slug: string
          title: string
          track_scope: string
          unlock_rule: Json
          updated_at: string
        }
        Insert: {
          checkpoint_family_key?: string | null
          created_at?: string
          estimated_minutes?: number
          id?: string
          lesson_key: string
          lesson_type?: string
          metadata?: Json
          module_id: string
          ordinal: number
          readiness_weight?: number
          slug: string
          title: string
          track_scope?: string
          unlock_rule?: Json
          updated_at?: string
        }
        Update: {
          checkpoint_family_key?: string | null
          created_at?: string
          estimated_minutes?: number
          id?: string
          lesson_key?: string
          lesson_type?: string
          metadata?: Json
          module_id?: string
          ordinal?: number
          readiness_weight?: number
          slug?: string
          title?: string
          track_scope?: string
          unlock_rule?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "russian_learning_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "russian_learning_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      russian_learning_modules: {
        Row: {
          cefr_band: string | null
          checkpoint_family_key: string | null
          course_id: string
          created_at: string
          description: string | null
          domain_track: string
          estimated_minutes: number
          id: string
          metadata: Json
          module_key: string
          module_type: string
          ordinal: number
          slug: string
          title: string
          unlock_rule: Json
          updated_at: string
        }
        Insert: {
          cefr_band?: string | null
          checkpoint_family_key?: string | null
          course_id: string
          created_at?: string
          description?: string | null
          domain_track?: string
          estimated_minutes?: number
          id?: string
          metadata?: Json
          module_key: string
          module_type?: string
          ordinal: number
          slug: string
          title: string
          unlock_rule?: Json
          updated_at?: string
        }
        Update: {
          cefr_band?: string | null
          checkpoint_family_key?: string | null
          course_id?: string
          created_at?: string
          description?: string | null
          domain_track?: string
          estimated_minutes?: number
          id?: string
          metadata?: Json
          module_key?: string
          module_type?: string
          ordinal?: number
          slug?: string
          title?: string
          unlock_rule?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "russian_learning_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "russian_learning_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      russian_placement_results: {
        Row: {
          answer_map_json: Json
          assessment_template_id: string | null
          attempt_no: number
          completed_at: string
          course_id: string
          created_at: string
          dimension_scores_json: Json
          id: string
          normalized_score: number
          placement_band: string
          raw_score: number
          recommended_course_key: string | null
          recommended_start_lesson_key: string | null
          recommended_start_module_key: string | null
          result_payload: Json
          unlocked_lesson_keys: string[]
          unlocked_module_keys: string[]
          user_id: string
        }
        Insert: {
          answer_map_json?: Json
          assessment_template_id?: string | null
          attempt_no?: number
          completed_at?: string
          course_id: string
          created_at?: string
          dimension_scores_json?: Json
          id?: string
          normalized_score?: number
          placement_band: string
          raw_score?: number
          recommended_course_key?: string | null
          recommended_start_lesson_key?: string | null
          recommended_start_module_key?: string | null
          result_payload?: Json
          unlocked_lesson_keys?: string[]
          unlocked_module_keys?: string[]
          user_id: string
        }
        Update: {
          answer_map_json?: Json
          assessment_template_id?: string | null
          attempt_no?: number
          completed_at?: string
          course_id?: string
          created_at?: string
          dimension_scores_json?: Json
          id?: string
          normalized_score?: number
          placement_band?: string
          raw_score?: number
          recommended_course_key?: string | null
          recommended_start_lesson_key?: string | null
          recommended_start_module_key?: string | null
          result_payload?: Json
          unlocked_lesson_keys?: string[]
          unlocked_module_keys?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "placement_results_assessment_template_id_fkey"
            columns: ["assessment_template_id"]
            isOneToOne: false
            referencedRelation: "russian_assessment_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "russian_placement_results_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "russian_learning_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      russian_readiness_dimensions: {
        Row: {
          created_at: string
          dashboard_order: number
          description: string | null
          dimension_group: string
          dimension_key: string
          id: string
          is_active: boolean
          label: string
          max_score: number
          metadata: Json
          score_unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dashboard_order?: number
          description?: string | null
          dimension_group: string
          dimension_key: string
          id?: string
          is_active?: boolean
          label: string
          max_score?: number
          metadata?: Json
          score_unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dashboard_order?: number
          description?: string | null
          dimension_group?: string
          dimension_key?: string
          id?: string
          is_active?: boolean
          label?: string
          max_score?: number
          metadata?: Json
          score_unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      scholarship_draft: {
        Row: {
          amount: number | null
          confidence_score: number | null
          content_hash: string | null
          coverage: string | null
          created_at: string | null
          currency: string | null
          deadline: string | null
          eligibility: string[] | null
          id: number
          name: string
          source_url: string | null
          status: string | null
          university_name: string
        }
        Insert: {
          amount?: number | null
          confidence_score?: number | null
          content_hash?: string | null
          coverage?: string | null
          created_at?: string | null
          currency?: string | null
          deadline?: string | null
          eligibility?: string[] | null
          id?: number
          name: string
          source_url?: string | null
          status?: string | null
          university_name: string
        }
        Update: {
          amount?: number | null
          confidence_score?: number | null
          content_hash?: string | null
          coverage?: string | null
          created_at?: string | null
          currency?: string | null
          deadline?: string | null
          eligibility?: string[] | null
          id?: number
          name?: string
          source_url?: string | null
          status?: string | null
          university_name?: string
        }
        Relationships: []
      }
      scholarship_links: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          offer_id: string | null
          program_id: string | null
          scholarship_id: string
          scope: string
          seats_allocated: number | null
          seats_used: number | null
          university_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          offer_id?: string | null
          program_id?: string | null
          scholarship_id: string
          scope?: string
          seats_allocated?: number | null
          seats_used?: number | null
          university_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          offer_id?: string | null
          program_id?: string | null
          scholarship_id?: string
          scope?: string
          seats_allocated?: number | null
          seats_used?: number | null
          university_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scholarship_links_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "program_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarship_links_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "scholarship_links_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarship_links_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "scholarship_links_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "scholarship_links_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "scholarship_links_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "scholarship_links_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "scholarship_links_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "scholarship_links_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarship_links_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "vw_scholarship_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarship_links_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "vw_scholarship_search_api"
            referencedColumns: ["scholarship_id"]
          },
          {
            foreignKeyName: "scholarship_links_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "vw_scholarships_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarship_links_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarship_links_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarship_links_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarship_links_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarship_links_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarship_links_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarship_links_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarship_links_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "scholarship_links_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarship_links_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarship_links_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarship_links_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      scholarships: {
        Row: {
          academic_year: string | null
          acceptance_rate: number | null
          amount: number | null
          amount_type: string | null
          amount_value: number | null
          application_url: string | null
          beneficiaries_count: number | null
          captured_at: string | null
          confidence: number | null
          content_hash: string | null
          country_code: string | null
          country_id: string | null
          coverage: Json | null
          coverage_type: string | null
          created_at: string | null
          currency_code: string | null
          deadline: string | null
          degree_id: string | null
          degree_level: string | null
          degree_slug: string | null
          description: string | null
          eligibility: string[] | null
          harvested_at: string | null
          id: string
          image_url: string | null
          is_active: boolean
          link: string | null
          percent_value: number | null
          program_id: string | null
          provider: string | null
          published_at: string | null
          rating: number | null
          source: string | null
          source_name: string | null
          status: string | null
          study_level: string | null
          title: string
          university_id: string | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          academic_year?: string | null
          acceptance_rate?: number | null
          amount?: number | null
          amount_type?: string | null
          amount_value?: number | null
          application_url?: string | null
          beneficiaries_count?: number | null
          captured_at?: string | null
          confidence?: number | null
          content_hash?: string | null
          country_code?: string | null
          country_id?: string | null
          coverage?: Json | null
          coverage_type?: string | null
          created_at?: string | null
          currency_code?: string | null
          deadline?: string | null
          degree_id?: string | null
          degree_level?: string | null
          degree_slug?: string | null
          description?: string | null
          eligibility?: string[] | null
          harvested_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link?: string | null
          percent_value?: number | null
          program_id?: string | null
          provider?: string | null
          published_at?: string | null
          rating?: number | null
          source?: string | null
          source_name?: string | null
          status?: string | null
          study_level?: string | null
          title: string
          university_id?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          academic_year?: string | null
          acceptance_rate?: number | null
          amount?: number | null
          amount_type?: string | null
          amount_value?: number | null
          application_url?: string | null
          beneficiaries_count?: number | null
          captured_at?: string | null
          confidence?: number | null
          content_hash?: string | null
          country_code?: string | null
          country_id?: string | null
          coverage?: Json | null
          coverage_type?: string | null
          created_at?: string | null
          currency_code?: string | null
          deadline?: string | null
          degree_id?: string | null
          degree_level?: string | null
          degree_slug?: string | null
          description?: string | null
          eligibility?: string[] | null
          harvested_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link?: string | null
          percent_value?: number | null
          program_id?: string | null
          provider?: string | null
          published_at?: string | null
          rating?: number | null
          source?: string | null
          source_name?: string | null
          status?: string | null
          study_level?: string | null
          title?: string
          university_id?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scholarships_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarships_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_events_search"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "scholarships_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "scholarships_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "scholarships_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "scholarships_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_scholarship_search"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "scholarships_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "scholarships_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "scholarships_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "scholarships_degree_id_fkey"
            columns: ["degree_id"]
            isOneToOne: false
            referencedRelation: "degrees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarships_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "scholarships_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarships_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "scholarships_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "scholarships_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "scholarships_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "scholarships_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "scholarships_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_backlinks: {
        Row: {
          anchor_text: string | null
          created_at: string | null
          domain_auth: number | null
          first_seen: string | null
          id: number
          last_seen: string | null
          notes: string | null
          rel: string | null
          source_domain: string | null
          source_url: string
          spam_score: number | null
          target_url: string
        }
        Insert: {
          anchor_text?: string | null
          created_at?: string | null
          domain_auth?: number | null
          first_seen?: string | null
          id?: number
          last_seen?: string | null
          notes?: string | null
          rel?: string | null
          source_domain?: string | null
          source_url: string
          spam_score?: number | null
          target_url: string
        }
        Update: {
          anchor_text?: string | null
          created_at?: string | null
          domain_auth?: number | null
          first_seen?: string | null
          id?: number
          last_seen?: string | null
          notes?: string | null
          rel?: string | null
          source_domain?: string | null
          source_url?: string
          spam_score?: number | null
          target_url?: string
        }
        Relationships: []
      }
      seo_crawl_snapshots: {
        Row: {
          canonical: string | null
          checked_at: string | null
          has_h1: boolean | null
          has_meta_desc: boolean | null
          has_title: boolean | null
          id: number
          noindex: boolean | null
          page: string
          status: number | null
          ttfb_ms: number | null
        }
        Insert: {
          canonical?: string | null
          checked_at?: string | null
          has_h1?: boolean | null
          has_meta_desc?: boolean | null
          has_title?: boolean | null
          id?: number
          noindex?: boolean | null
          page: string
          status?: number | null
          ttfb_ms?: number | null
        }
        Update: {
          canonical?: string | null
          checked_at?: string | null
          has_h1?: boolean | null
          has_meta_desc?: boolean | null
          has_title?: boolean | null
          id?: number
          noindex?: boolean | null
          page?: string
          status?: number | null
          ttfb_ms?: number | null
        }
        Relationships: []
      }
      seo_experiment_metrics: {
        Row: {
          clicks: number | null
          conversions: number | null
          ctr: number | null
          day: string
          experiment_id: number | null
          id: number
          impressions: number | null
          pageviews: number | null
          sessions: number | null
          updated_at: string | null
          variant_id: number | null
        }
        Insert: {
          clicks?: number | null
          conversions?: number | null
          ctr?: number | null
          day: string
          experiment_id?: number | null
          id?: number
          impressions?: number | null
          pageviews?: number | null
          sessions?: number | null
          updated_at?: string | null
          variant_id?: number | null
        }
        Update: {
          clicks?: number | null
          conversions?: number | null
          ctr?: number | null
          day?: string
          experiment_id?: number | null
          id?: number
          impressions?: number | null
          pageviews?: number | null
          sessions?: number | null
          updated_at?: string | null
          variant_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "seo_experiment_metrics_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "seo_experiments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_experiment_metrics_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "seo_experiment_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_experiment_variants: {
        Row: {
          experiment_id: number | null
          h1_override: string | null
          id: number
          json_payload: Json | null
          meta_desc_override: string | null
          name: string | null
          title_override: string | null
          weight: number | null
        }
        Insert: {
          experiment_id?: number | null
          h1_override?: string | null
          id?: number
          json_payload?: Json | null
          meta_desc_override?: string | null
          name?: string | null
          title_override?: string | null
          weight?: number | null
        }
        Update: {
          experiment_id?: number | null
          h1_override?: string | null
          id?: number
          json_payload?: Json | null
          meta_desc_override?: string | null
          name?: string | null
          title_override?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "seo_experiment_variants_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "seo_experiments"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_experiments: {
        Row: {
          created_at: string | null
          created_by: string | null
          end_at: string | null
          id: number
          metric: string
          scope: string
          slug: string | null
          start_at: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          end_at?: string | null
          id?: number
          metric: string
          scope: string
          slug?: string | null
          start_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          end_at?: string | null
          id?: number
          metric?: string
          scope?: string
          slug?: string | null
          start_at?: string | null
          status?: string
        }
        Relationships: []
      }
      seo_gsc_config: {
        Row: {
          created_at: string | null
          id: number
          is_bk_auto: boolean | null
          is_daily_sync: boolean | null
          property_url: string
          svc_email: string
          svc_key_pem: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: never
          is_bk_auto?: boolean | null
          is_daily_sync?: boolean | null
          property_url: string
          svc_email: string
          svc_key_pem: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: never
          is_bk_auto?: boolean | null
          is_daily_sync?: boolean | null
          property_url?: string
          svc_email?: string
          svc_key_pem?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      seo_gsc_daily: {
        Row: {
          clicks: number | null
          country_slug: string | null
          created_at: string | null
          ctr: number | null
          date: string
          id: number
          impressions: number | null
          page: string
          position: number | null
        }
        Insert: {
          clicks?: number | null
          country_slug?: string | null
          created_at?: string | null
          ctr?: number | null
          date: string
          id?: number
          impressions?: number | null
          page: string
          position?: number | null
        }
        Update: {
          clicks?: number | null
          country_slug?: string | null
          created_at?: string | null
          ctr?: number | null
          date?: string
          id?: number
          impressions?: number | null
          page?: string
          position?: number | null
        }
        Relationships: []
      }
      seo_job_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: number
          job_id: string | null
          ok: boolean | null
          started_at: string | null
          stats: Json | null
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: number
          job_id?: string | null
          ok?: boolean | null
          started_at?: string | null
          stats?: Json | null
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: number
          job_id?: string | null
          ok?: boolean | null
          started_at?: string | null
          stats?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "seo_job_runs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "seo_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_jobs: {
        Row: {
          created_by: string | null
          id: string
          kind: string
          scheduled_at: string | null
          scope: string | null
          status: string | null
        }
        Insert: {
          created_by?: string | null
          id?: string
          kind: string
          scheduled_at?: string | null
          scope?: string | null
          status?: string | null
        }
        Update: {
          created_by?: string | null
          id?: string
          kind?: string
          scheduled_at?: string | null
          scope?: string | null
          status?: string | null
        }
        Relationships: []
      }
      seo_scores: {
        Row: {
          calculated_at: string | null
          content_freshness: number | null
          country_slug: string
          coverage: number | null
          ctr_change: number | null
          cwv_score: number | null
          id: number
          index_speed: number | null
          locale: string
          score: number | null
        }
        Insert: {
          calculated_at?: string | null
          content_freshness?: number | null
          country_slug: string
          coverage?: number | null
          ctr_change?: number | null
          cwv_score?: number | null
          id?: number
          index_speed?: number | null
          locale: string
          score?: number | null
        }
        Update: {
          calculated_at?: string | null
          content_freshness?: number | null
          country_slug?: string
          coverage?: number | null
          ctr_change?: number | null
          cwv_score?: number | null
          id?: number
          index_speed?: number | null
          locale?: string
          score?: number | null
        }
        Relationships: []
      }
      service_regions: {
        Row: {
          country_codes: string[]
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name_key: string
          slug: string
        }
        Insert: {
          country_codes?: string[]
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name_key: string
          slug: string
        }
        Update: {
          country_codes?: string[]
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name_key?: string
          slug?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          currency: string | null
          description: string | null
          icon_key: string | null
          id: string
          is_active: boolean | null
          name: string
          price: number | null
          slug: string
        }
        Insert: {
          currency?: string | null
          description?: string | null
          icon_key?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price?: number | null
          slug: string
        }
        Update: {
          currency?: string | null
          description?: string | null
          icon_key?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number | null
          slug?: string
        }
        Relationships: []
      }
      services_pricing_configs: {
        Row: {
          addons: Json
          base_prices: Json
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          packages: Json
          pay_rules: Json | null
          reason: string | null
          services: Json
          updated_at: string | null
          version: string
        }
        Insert: {
          addons?: Json
          base_prices?: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          packages?: Json
          pay_rules?: Json | null
          reason?: string | null
          services?: Json
          updated_at?: string | null
          version: string
        }
        Update: {
          addons?: Json
          base_prices?: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          packages?: Json
          pay_rules?: Json | null
          reason?: string | null
          services?: Json
          updated_at?: string | null
          version?: string
        }
        Relationships: []
      }
      session_action_items: {
        Row: {
          action_type: string
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_at: string | null
          id: string
          priority: string
          recap_available: boolean | null
          related_lesson_slug: string | null
          related_module_slug: string | null
          review_decision: string | null
          score: number | null
          session_id: string
          status: string
          student_response: string | null
          student_user_id: string
          teacher_feedback: string | null
          teacher_user_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          action_type?: string
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: string
          recap_available?: boolean | null
          related_lesson_slug?: string | null
          related_module_slug?: string | null
          review_decision?: string | null
          score?: number | null
          session_id: string
          status?: string
          student_response?: string | null
          student_user_id: string
          teacher_feedback?: string | null
          teacher_user_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          action_type?: string
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: string
          recap_available?: boolean | null
          related_lesson_slug?: string | null
          related_module_slug?: string | null
          review_decision?: string | null
          score?: number | null
          session_id?: string
          status?: string
          student_response?: string | null
          student_user_id?: string
          teacher_feedback?: string | null
          teacher_user_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          contact_address: string | null
          contact_email: string | null
          contact_whatsapp: string | null
          currency: string | null
          default_sort: string | null
          flags: Json | null
          id: boolean
          site_name: string | null
          site_readonly: boolean | null
          sliders: Json | null
          theme: Json | null
        }
        Insert: {
          contact_address?: string | null
          contact_email?: string | null
          contact_whatsapp?: string | null
          currency?: string | null
          default_sort?: string | null
          flags?: Json | null
          id?: boolean
          site_name?: string | null
          site_readonly?: boolean | null
          sliders?: Json | null
          theme?: Json | null
        }
        Update: {
          contact_address?: string | null
          contact_email?: string | null
          contact_whatsapp?: string | null
          currency?: string | null
          default_sort?: string | null
          flags?: Json | null
          id?: boolean
          site_name?: string | null
          site_readonly?: boolean | null
          sliders?: Json | null
          theme?: Json | null
        }
        Relationships: []
      }
      slider_content_i18n: {
        Row: {
          created_at: string | null
          id: number
          locale: string
          slide1_badge: string
          slide1_cta: string
          slide1_description: string
          slide1_subtitle: string
          slide1_title: string
          slide2_badge: string
          slide2_cta: string
          slide2_description: string
          slide2_subtitle: string
          slide2_title: string
          slide3_badge: string
          slide3_cta: string
          slide3_description: string
          slide3_subtitle: string
          slide3_title: string
          stats_countries_label: string
          stats_service_label: string
          stats_service_value: string
          stats_students_label: string
          stats_universities_label: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          locale: string
          slide1_badge?: string
          slide1_cta?: string
          slide1_description?: string
          slide1_subtitle?: string
          slide1_title?: string
          slide2_badge?: string
          slide2_cta?: string
          slide2_description?: string
          slide2_subtitle?: string
          slide2_title?: string
          slide3_badge?: string
          slide3_cta?: string
          slide3_description?: string
          slide3_subtitle?: string
          slide3_title?: string
          stats_countries_label?: string
          stats_service_label?: string
          stats_service_value?: string
          stats_students_label?: string
          stats_universities_label?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          locale?: string
          slide1_badge?: string
          slide1_cta?: string
          slide1_description?: string
          slide1_subtitle?: string
          slide1_title?: string
          slide2_badge?: string
          slide2_cta?: string
          slide2_description?: string
          slide2_subtitle?: string
          slide2_title?: string
          slide3_badge?: string
          slide3_cta?: string
          slide3_description?: string
          slide3_subtitle?: string
          slide3_title?: string
          stats_countries_label?: string
          stats_service_label?: string
          stats_service_value?: string
          stats_students_label?: string
          stats_universities_label?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      slider_universities: {
        Row: {
          alt_text: string | null
          created_at: string
          end_at: string | null
          id: number
          image_url: string | null
          last_editor: string | null
          locale: string
          published: boolean
          start_at: string | null
          university_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          end_at?: string | null
          id?: number
          image_url?: string | null
          last_editor?: string | null
          locale?: string
          published?: boolean
          start_at?: string | null
          university_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          end_at?: string | null
          id?: number
          image_url?: string | null
          last_editor?: string | null
          locale?: string
          published?: boolean
          start_at?: string | null
          university_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "slider_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "slider_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "slider_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slider_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "slider_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "slider_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "slider_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "slider_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "slider_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slider_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "slider_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "slider_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      source_evidence: {
        Row: {
          academic_year: string | null
          captured_at: string | null
          confidence: number | null
          confidence_score: number | null
          content_hash: string | null
          country_code: string | null
          extraction_error: string | null
          extractor: string | null
          field: string | null
          field_source: string | null
          id: number
          is_primary: boolean | null
          page_lang: string | null
          program_draft_id: number | null
          program_id: string | null
          selector: string | null
          source_url: string
          text_snippet: string | null
          tuition_basis: string | null
          tuition_scope: string | null
        }
        Insert: {
          academic_year?: string | null
          captured_at?: string | null
          confidence?: number | null
          confidence_score?: number | null
          content_hash?: string | null
          country_code?: string | null
          extraction_error?: string | null
          extractor?: string | null
          field?: string | null
          field_source?: string | null
          id?: number
          is_primary?: boolean | null
          page_lang?: string | null
          program_draft_id?: number | null
          program_id?: string | null
          selector?: string | null
          source_url: string
          text_snippet?: string | null
          tuition_basis?: string | null
          tuition_scope?: string | null
        }
        Update: {
          academic_year?: string | null
          captured_at?: string | null
          confidence?: number | null
          confidence_score?: number | null
          content_hash?: string | null
          country_code?: string | null
          extraction_error?: string | null
          extractor?: string | null
          field?: string | null
          field_source?: string | null
          id?: number
          is_primary?: boolean | null
          page_lang?: string | null
          program_draft_id?: number | null
          program_id?: string | null
          selector?: string | null
          source_url?: string
          text_snippet?: string | null
          tuition_basis?: string | null
          tuition_scope?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_evidence_program_draft_id_fkey"
            columns: ["program_draft_id"]
            isOneToOne: false
            referencedRelation: "door2_review_current_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_evidence_program_draft_id_fkey"
            columns: ["program_draft_id"]
            isOneToOne: false
            referencedRelation: "program_draft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_evidence_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "source_evidence_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_evidence_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "source_evidence_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "source_evidence_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "source_evidence_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "source_evidence_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "source_evidence_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["program_id"]
          },
        ]
      }
      spreadsheet_enrichment_staging: {
        Row: {
          applied: boolean | null
          city: string | null
          country_code: string | null
          created_at: string | null
          id: number
          map_location: string | null
          name_en: string
          official_website: string | null
          resolution_status: string | null
        }
        Insert: {
          applied?: boolean | null
          city?: string | null
          country_code?: string | null
          created_at?: string | null
          id?: number
          map_location?: string | null
          name_en: string
          official_website?: string | null
          resolution_status?: string | null
        }
        Update: {
          applied?: boolean | null
          city?: string | null
          country_code?: string | null
          created_at?: string | null
          id?: number
          map_location?: string | null
          name_en?: string
          official_website?: string | null
          resolution_status?: string | null
        }
        Relationships: []
      }
      student_admin_audit_log_v1: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          new_data: Json | null
          old_data: Json | null
          staff_auth_user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          staff_auth_user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          staff_auth_user_id?: string | null
        }
        Relationships: []
      }
      student_case_events_v1: {
        Row: {
          application_id: string | null
          created_at: string
          created_by_staff_user_id: string | null
          description: string | null
          due_at: string | null
          event_type: string
          id: string
          meta: Json
          status: string
          title: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          created_by_staff_user_id?: string | null
          description?: string | null
          due_at?: string | null
          event_type: string
          id?: string
          meta?: Json
          status?: string
          title: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          created_at?: string
          created_by_staff_user_id?: string | null
          description?: string | null
          due_at?: string | null
          event_type?: string
          id?: string
          meta?: Json
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_case_events_v1_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      student_contracts_v1: {
        Row: {
          application_id: string | null
          consent_version: string | null
          contract_file_id: string | null
          created_at: string
          id: string
          meta: Json
          signed_at: string | null
          signed_by_auth_user_id: string | null
          signed_contract_file_id: string | null
          signed_ip: string | null
          signed_user_agent: string | null
          status: string
          template_key: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          consent_version?: string | null
          contract_file_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          signed_at?: string | null
          signed_by_auth_user_id?: string | null
          signed_contract_file_id?: string | null
          signed_ip?: string | null
          signed_user_agent?: string | null
          status?: string
          template_key: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          consent_version?: string | null
          contract_file_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          signed_at?: string | null
          signed_by_auth_user_id?: string | null
          signed_contract_file_id?: string | null
          signed_ip?: string | null
          signed_user_agent?: string | null
          status?: string
          template_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_contracts_v1_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      student_course_state: {
        Row: {
          course_key: string
          created_at: string
          current_lesson_slug: string | null
          current_module_slug: string | null
          id: string
          last_student_activity_at: string | null
          last_teacher_action_at: string | null
          next_teacher_decision: string | null
          progression_status: string
          student_user_id: string
          updated_at: string
        }
        Insert: {
          course_key?: string
          created_at?: string
          current_lesson_slug?: string | null
          current_module_slug?: string | null
          id?: string
          last_student_activity_at?: string | null
          last_teacher_action_at?: string | null
          next_teacher_decision?: string | null
          progression_status?: string
          student_user_id: string
          updated_at?: string
        }
        Update: {
          course_key?: string
          created_at?: string
          current_lesson_slug?: string | null
          current_module_slug?: string | null
          id?: string
          last_student_activity_at?: string | null
          last_teacher_action_at?: string | null
          next_teacher_decision?: string | null
          progression_status?: string
          student_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_delivery_requests_v1: {
        Row: {
          address: Json
          application_id: string | null
          created_at: string
          delivery_type: string
          id: string
          meta: Json
          shipping_fee_payment_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address: Json
          application_id?: string | null
          created_at?: string
          delivery_type: string
          id?: string
          meta?: Json
          shipping_fee_payment_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: Json
          application_id?: string | null
          created_at?: string
          delivery_type?: string
          id?: string
          meta?: Json
          shipping_fee_payment_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_delivery_requests_v1_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      student_friendships: {
        Row: {
          course_key: string | null
          created_at: string
          id: string
          recipient_id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          course_key?: string | null
          created_at?: string
          id?: string
          recipient_id: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          course_key?: string | null
          created_at?: string
          id?: string
          recipient_id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_lesson_progression: {
        Row: {
          completed_at: string | null
          course_key: string
          created_at: string
          id: string
          lesson_slug: string
          mastery_score: number | null
          module_slug: string | null
          released_at: string | null
          released_by: string | null
          status: string
          student_user_id: string
          teacher_notes: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          course_key?: string
          created_at?: string
          id?: string
          lesson_slug: string
          mastery_score?: number | null
          module_slug?: string | null
          released_at?: string | null
          released_by?: string | null
          status?: string
          student_user_id: string
          teacher_notes?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          course_key?: string
          created_at?: string
          id?: string
          lesson_slug?: string
          mastery_score?: number | null
          module_slug?: string | null
          released_at?: string | null
          released_by?: string | null
          status?: string
          student_user_id?: string
          teacher_notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      student_notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      student_peer_messages: {
        Row: {
          content: string
          created_at: string
          friendship_id: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          friendship_id: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          friendship_id?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_peer_messages_friendship_id_fkey"
            columns: ["friendship_id"]
            isOneToOne: false
            referencedRelation: "student_friendships"
            referencedColumns: ["id"]
          },
        ]
      }
      student_service_jobs_v1: {
        Row: {
          application_id: string | null
          completed_at: string | null
          created_at: string
          delivery_address: Json | null
          delivery_option: string | null
          due_at: string | null
          id: string
          job_type: string
          meta: Json
          price_extra: number | null
          status: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          completed_at?: string | null
          created_at?: string
          delivery_address?: Json | null
          delivery_option?: string | null
          due_at?: string | null
          id?: string
          job_type: string
          meta?: Json
          price_extra?: number | null
          status?: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          completed_at?: string | null
          created_at?: string
          delivery_address?: Json | null
          delivery_option?: string | null
          due_at?: string | null
          id?: string
          job_type?: string
          meta?: Json
          price_extra?: number | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_service_jobs_v1_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      student_shortlists: {
        Row: {
          country_id: string
          created_at: string
          id: string
          student_id: string
          university_id: string
        }
        Insert: {
          country_id: string
          created_at?: string
          id?: string
          student_id: string
          university_id: string
        }
        Update: {
          country_id?: string
          created_at?: string
          id?: string
          student_id?: string
          university_id?: string
        }
        Relationships: []
      }
      student_timeline_events: {
        Row: {
          created_at: string | null
          created_by: string | null
          event_data: Json | null
          event_description: string | null
          event_title: string
          event_type: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          event_data?: Json | null
          event_description?: string | null
          event_title: string
          event_type: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          event_data?: Json | null
          event_description?: string | null
          event_title?: string
          event_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          created_at: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      system_alerts: {
        Row: {
          acknowledged: boolean | null
          created_at: string | null
          id: number
          level: string
          message: string
          meta: Json | null
          source: string
        }
        Insert: {
          acknowledged?: boolean | null
          created_at?: string | null
          id?: number
          level: string
          message: string
          meta?: Json | null
          source: string
        }
        Update: {
          acknowledged?: boolean | null
          created_at?: string | null
          id?: number
          level?: string
          message?: string
          meta?: Json | null
          source?: string
        }
        Relationships: []
      }
      system_flags: {
        Row: {
          config: Json | null
          enabled: boolean
          key: string
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          enabled?: boolean
          key: string
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          enabled?: boolean
          key?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      teacher_ai_followups: {
        Row: {
          common_mistakes: Json
          confusion_topics: Json
          created_at: string
          escalation_requested: boolean
          id: string
          language_key: string
          lesson_slug: string | null
          module_slug: string | null
          practice_completion: number | null
          recap_used: boolean
          student_questions: Json
          student_user_id: string
          teacher_user_id: string
        }
        Insert: {
          common_mistakes?: Json
          confusion_topics?: Json
          created_at?: string
          escalation_requested?: boolean
          id?: string
          language_key?: string
          lesson_slug?: string | null
          module_slug?: string | null
          practice_completion?: number | null
          recap_used?: boolean
          student_questions?: Json
          student_user_id: string
          teacher_user_id: string
        }
        Update: {
          common_mistakes?: Json
          confusion_topics?: Json
          created_at?: string
          escalation_requested?: boolean
          id?: string
          language_key?: string
          lesson_slug?: string | null
          module_slug?: string | null
          practice_completion?: number | null
          recap_used?: boolean
          student_questions?: Json
          student_user_id?: string
          teacher_user_id?: string
        }
        Relationships: []
      }
      teacher_availability: {
        Row: {
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean | null
          start_time: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean | null
          start_time: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean | null
          start_time?: string
          user_id?: string
        }
        Relationships: []
      }
      teacher_availability_exceptions: {
        Row: {
          created_at: string | null
          end_time: string | null
          exception_date: string
          exception_type: string
          id: string
          reason: string | null
          start_time: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          end_time?: string | null
          exception_date: string
          exception_type?: string
          id?: string
          reason?: string | null
          start_time?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          end_time?: string | null
          exception_date?: string
          exception_type?: string
          id?: string
          reason?: string | null
          start_time?: string | null
          user_id?: string
        }
        Relationships: []
      }
      teacher_availability_preferences: {
        Row: {
          buffer_after_minutes: number
          buffer_before_minutes: number
          created_at: string | null
          default_session_duration: number
          id: string
          max_sessions_per_day: number | null
          public_booking_enabled: boolean
          session_duration_presets: number[]
          timezone: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          created_at?: string | null
          default_session_duration?: number
          id?: string
          max_sessions_per_day?: number | null
          public_booking_enabled?: boolean
          session_duration_presets?: number[]
          timezone?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          created_at?: string | null
          default_session_duration?: number
          id?: string
          max_sessions_per_day?: number | null
          public_booking_enabled?: boolean
          session_duration_presets?: number[]
          timezone?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      teacher_availability_rules: {
        Row: {
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          start_time: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          start_time: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          start_time?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      teacher_certificates: {
        Row: {
          created_at: string | null
          id: string
          is_verified: boolean | null
          issuer: string | null
          title: string
          user_id: string
          year_end: number | null
          year_start: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          issuer?: string | null
          title: string
          user_id: string
          year_end?: number | null
          year_start?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          issuer?: string | null
          title?: string
          user_id?: string
          year_end?: number | null
          year_start?: number | null
        }
        Relationships: []
      }
      teacher_documents: {
        Row: {
          created_at: string
          doc_type: string
          file_name: string
          file_url: string | null
          id: string
          mime_type: string | null
          rejection_reason: string | null
          reviewer_notes: string | null
          size_bytes: number | null
          staff_email: string
          storage_bucket: string | null
          storage_path: string | null
          updated_at: string
          verification_status: string
        }
        Insert: {
          created_at?: string
          doc_type?: string
          file_name: string
          file_url?: string | null
          id?: string
          mime_type?: string | null
          rejection_reason?: string | null
          reviewer_notes?: string | null
          size_bytes?: number | null
          staff_email: string
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
          verification_status?: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          file_name?: string
          file_url?: string | null
          id?: string
          mime_type?: string | null
          rejection_reason?: string | null
          reviewer_notes?: string | null
          size_bytes?: number | null
          staff_email?: string
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
          verification_status?: string
        }
        Relationships: []
      }
      teacher_exam_modes: {
        Row: {
          countdown_days: number | null
          created_at: string
          daily_target_sessions: number
          daily_targets: Json
          emergency_catchup_enabled: boolean
          exam_date: string | null
          exam_target: string | null
          id: string
          language_key: string
          mock_readiness_score: number | null
          required_sessions_per_week: number
          risk_flags: Json
          student_user_id: string
          teacher_user_id: string
          updated_at: string
        }
        Insert: {
          countdown_days?: number | null
          created_at?: string
          daily_target_sessions?: number
          daily_targets?: Json
          emergency_catchup_enabled?: boolean
          exam_date?: string | null
          exam_target?: string | null
          id?: string
          language_key?: string
          mock_readiness_score?: number | null
          required_sessions_per_week?: number
          risk_flags?: Json
          student_user_id: string
          teacher_user_id: string
          updated_at?: string
        }
        Update: {
          countdown_days?: number | null
          created_at?: string
          daily_target_sessions?: number
          daily_targets?: Json
          emergency_catchup_enabled?: boolean
          exam_date?: string | null
          exam_target?: string | null
          id?: string
          language_key?: string
          mock_readiness_score?: number | null
          required_sessions_per_week?: number
          risk_flags?: Json
          student_user_id?: string
          teacher_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      teacher_intro_videos: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          status: string
          title: string | null
          updated_at: string
          user_id: string
          video_path: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
          video_path: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
          video_path?: string
          video_url?: string | null
        }
        Relationships: []
      }
      teacher_notes: {
        Row: {
          created_at: string
          id: string
          language_key: string
          note: string
          student_user_id: string
          teacher_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          language_key?: string
          note: string
          student_user_id: string
          teacher_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          language_key?: string
          note?: string
          student_user_id?: string
          teacher_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      teacher_plans: {
        Row: {
          ai_policy: Json
          checkpoint_payload: Json
          created_at: string
          end_date: string | null
          homework_payload: Json
          id: string
          language_key: string
          plan_type: string
          start_date: string | null
          status: string
          student_user_id: string
          target_lessons: Json
          teacher_type: string
          teacher_user_id: string
          title: string
          updated_at: string
        }
        Insert: {
          ai_policy?: Json
          checkpoint_payload?: Json
          created_at?: string
          end_date?: string | null
          homework_payload?: Json
          id?: string
          language_key?: string
          plan_type: string
          start_date?: string | null
          status?: string
          student_user_id: string
          target_lessons?: Json
          teacher_type?: string
          teacher_user_id: string
          title: string
          updated_at?: string
        }
        Update: {
          ai_policy?: Json
          checkpoint_payload?: Json
          created_at?: string
          end_date?: string | null
          homework_payload?: Json
          id?: string
          language_key?: string
          plan_type?: string
          start_date?: string | null
          status?: string
          student_user_id?: string
          target_lessons?: Json
          teacher_type?: string
          teacher_user_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      teacher_public_profiles: {
        Row: {
          avatar_url: string | null
          badges: string[] | null
          bio: string | null
          booked_recently: number | null
          country: string | null
          country_code: string | null
          created_at: string | null
          display_name: string | null
          education: string | null
          id: string
          is_published: boolean | null
          languages_spoken: string[] | null
          lesson_duration_minutes: number | null
          lessons_count: number | null
          price_per_lesson: number | null
          rating: number | null
          response_time: string | null
          reviews_count: number | null
          specialty: string | null
          students_count: number | null
          teaches_subject: string | null
          teaching_experience: string | null
          timezone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          badges?: string[] | null
          bio?: string | null
          booked_recently?: number | null
          country?: string | null
          country_code?: string | null
          created_at?: string | null
          display_name?: string | null
          education?: string | null
          id?: string
          is_published?: boolean | null
          languages_spoken?: string[] | null
          lesson_duration_minutes?: number | null
          lessons_count?: number | null
          price_per_lesson?: number | null
          rating?: number | null
          response_time?: string | null
          reviews_count?: number | null
          specialty?: string | null
          students_count?: number | null
          teaches_subject?: string | null
          teaching_experience?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          badges?: string[] | null
          bio?: string | null
          booked_recently?: number | null
          country?: string | null
          country_code?: string | null
          created_at?: string | null
          display_name?: string | null
          education?: string | null
          id?: string
          is_published?: boolean | null
          languages_spoken?: string[] | null
          lesson_duration_minutes?: number | null
          lessons_count?: number | null
          price_per_lesson?: number | null
          rating?: number | null
          response_time?: string | null
          reviews_count?: number | null
          specialty?: string | null
          students_count?: number | null
          teaches_subject?: string | null
          teaching_experience?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      teacher_review_items: {
        Row: {
          assigned_action: Json | null
          created_at: string
          id: string
          lesson_slug: string | null
          module_slug: string | null
          outreach_log: Json
          queue_type: string
          reason: string
          recommended_next_action: string | null
          resolved_at: string | null
          session_id: string | null
          status: string
          student_user_id: string | null
          teacher_user_id: string
          updated_at: string
          urgency: string
        }
        Insert: {
          assigned_action?: Json | null
          created_at?: string
          id?: string
          lesson_slug?: string | null
          module_slug?: string | null
          outreach_log?: Json
          queue_type: string
          reason: string
          recommended_next_action?: string | null
          resolved_at?: string | null
          session_id?: string | null
          status?: string
          student_user_id?: string | null
          teacher_user_id: string
          updated_at?: string
          urgency?: string
        }
        Update: {
          assigned_action?: Json | null
          created_at?: string
          id?: string
          lesson_slug?: string | null
          module_slug?: string | null
          outreach_log?: Json
          queue_type?: string
          reason?: string
          recommended_next_action?: string | null
          resolved_at?: string | null
          session_id?: string | null
          status?: string
          student_user_id?: string | null
          teacher_user_id?: string
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_review_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "teacher_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_session_notes: {
        Row: {
          created_at: string
          id: string
          next_action: string | null
          session_id: string
          summary: string
          teacher_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          next_action?: string | null
          session_id: string
          summary: string
          teacher_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          next_action?: string | null
          session_id?: string
          summary?: string
          teacher_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_session_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "teacher_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_session_students: {
        Row: {
          attendance_status: string | null
          created_at: string
          id: string
          session_id: string
          student_user_id: string
        }
        Insert: {
          attendance_status?: string | null
          created_at?: string
          id?: string
          session_id: string
          student_user_id: string
        }
        Update: {
          attendance_status?: string | null
          created_at?: string
          id?: string
          session_id?: string
          student_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_session_students_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "teacher_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_sessions: {
        Row: {
          created_at: string
          curriculum_course_id: string | null
          curriculum_lesson_id: string | null
          curriculum_module_id: string | null
          id: string
          language_key: string
          lesson_slug: string | null
          module_slug: string | null
          next_action: string | null
          scheduled_at: string | null
          session_type: string
          status: string
          summary: string | null
          teacher_type: string
          teacher_user_id: string
          updated_at: string
          zoom_link: string | null
        }
        Insert: {
          created_at?: string
          curriculum_course_id?: string | null
          curriculum_lesson_id?: string | null
          curriculum_module_id?: string | null
          id?: string
          language_key?: string
          lesson_slug?: string | null
          module_slug?: string | null
          next_action?: string | null
          scheduled_at?: string | null
          session_type?: string
          status?: string
          summary?: string | null
          teacher_type?: string
          teacher_user_id: string
          updated_at?: string
          zoom_link?: string | null
        }
        Update: {
          created_at?: string
          curriculum_course_id?: string | null
          curriculum_lesson_id?: string | null
          curriculum_module_id?: string | null
          id?: string
          language_key?: string
          lesson_slug?: string | null
          module_slug?: string | null
          next_action?: string | null
          scheduled_at?: string | null
          session_type?: string
          status?: string
          summary?: string | null
          teacher_type?: string
          teacher_user_id?: string
          updated_at?: string
          zoom_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_sessions_curriculum_course_id_fkey"
            columns: ["curriculum_course_id"]
            isOneToOne: false
            referencedRelation: "russian_learning_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_sessions_curriculum_lesson_id_fkey"
            columns: ["curriculum_lesson_id"]
            isOneToOne: false
            referencedRelation: "russian_learning_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_sessions_curriculum_module_id_fkey"
            columns: ["curriculum_module_id"]
            isOneToOne: false
            referencedRelation: "russian_learning_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_state_cache: {
        Row: {
          access_scope: string | null
          approval_status: string | null
          blockers: Json
          can_teach: boolean
          crm_staff_id: string | null
          education_verified: boolean
          email: string | null
          full_name: string | null
          identity_verified: boolean
          is_active: boolean
          more_info_reason: string | null
          phone: string | null
          portal_auth_user_id: string
          rejection_reason: string | null
          reviewer_notes: string | null
          role: string
          source_version: string | null
          synced_at: string
        }
        Insert: {
          access_scope?: string | null
          approval_status?: string | null
          blockers?: Json
          can_teach?: boolean
          crm_staff_id?: string | null
          education_verified?: boolean
          email?: string | null
          full_name?: string | null
          identity_verified?: boolean
          is_active?: boolean
          more_info_reason?: string | null
          phone?: string | null
          portal_auth_user_id: string
          rejection_reason?: string | null
          reviewer_notes?: string | null
          role?: string
          source_version?: string | null
          synced_at?: string
        }
        Update: {
          access_scope?: string | null
          approval_status?: string | null
          blockers?: Json
          can_teach?: boolean
          crm_staff_id?: string | null
          education_verified?: boolean
          email?: string | null
          full_name?: string | null
          identity_verified?: boolean
          is_active?: boolean
          more_info_reason?: string | null
          phone?: string | null
          portal_auth_user_id?: string
          rejection_reason?: string | null
          reviewer_notes?: string | null
          role?: string
          source_version?: string | null
          synced_at?: string
        }
        Relationships: []
      }
      teacher_student_session_evaluations: {
        Row: {
          confidence_score: number | null
          created_at: string
          id: string
          language_key: string
          lesson_slug: string | null
          needs_review: boolean
          note: string | null
          participation_score: number | null
          recommended_next_action: string | null
          session_id: string
          student_user_id: string
          teacher_user_id: string
          understanding_score: number | null
          updated_at: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          language_key?: string
          lesson_slug?: string | null
          needs_review?: boolean
          note?: string | null
          participation_score?: number | null
          recommended_next_action?: string | null
          session_id: string
          student_user_id: string
          teacher_user_id: string
          understanding_score?: number | null
          updated_at?: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          language_key?: string
          lesson_slug?: string | null
          needs_review?: boolean
          note?: string | null
          participation_score?: number | null
          recommended_next_action?: string | null
          session_id?: string
          student_user_id?: string
          teacher_user_id?: string
          understanding_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_student_session_evaluations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "teacher_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_website_import: {
        Row: {
          id: number
          name: string
          website: string
        }
        Insert: {
          id?: number
          name: string
          website: string
        }
        Update: {
          id?: number
          name?: string
          website?: string
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          featured: boolean | null
          id: string
          order: number | null
          quote: string | null
          student_name: string | null
          thumbnail_url: string | null
          video_url: string | null
        }
        Insert: {
          featured?: boolean | null
          id?: string
          order?: number | null
          quote?: string | null
          student_name?: string | null
          thumbnail_url?: string | null
          video_url?: string | null
        }
        Update: {
          featured?: boolean | null
          id?: string
          order?: number | null
          quote?: string | null
          student_name?: string | null
          thumbnail_url?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      translation_glossary: {
        Row: {
          created_at: string
          domain: string
          id: string
          notes: string | null
          preserve_rule: string | null
          source_locale: string
          source_text: string
          target_locale: string
          target_text: string
          term_key: string
          term_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain?: string
          id?: string
          notes?: string | null
          preserve_rule?: string | null
          source_locale?: string
          source_text: string
          target_locale: string
          target_text: string
          term_key: string
          term_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          notes?: string | null
          preserve_rule?: string | null
          source_locale?: string
          source_text?: string
          target_locale?: string
          target_text?: string
          term_key?: string
          term_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      translation_jobs: {
        Row: {
          attempts: number
          created_at: string
          entity_id: string
          entity_type: string
          field_name: string
          id: string
          last_error: string | null
          priority: number
          processed_at: string | null
          source_lang: string
          source_text: string
          started_at: string | null
          status: string
          target_lang: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          entity_id: string
          entity_type: string
          field_name: string
          id?: string
          last_error?: string | null
          priority?: number
          processed_at?: string | null
          source_lang?: string
          source_text: string
          started_at?: string | null
          status?: string
          target_lang: string
        }
        Update: {
          attempts?: number
          created_at?: string
          entity_id?: string
          entity_type?: string
          field_name?: string
          id?: string
          last_error?: string | null
          priority?: number
          processed_at?: string | null
          source_lang?: string
          source_text?: string
          started_at?: string | null
          status?: string
          target_lang?: string
        }
        Relationships: []
      }
      translation_jobs_v2: {
        Row: {
          attempts: number
          claimed_at: string | null
          created_at: string
          entity_id: string
          entity_type: string
          error_message: string | null
          field_name: string
          glossary_applied: boolean
          id: string
          max_attempts: number
          model_used: string | null
          priority: number
          processed_at: string | null
          source_hash: string
          source_locale: string
          source_text: string
          status: string
          target_locale: string
          translated_text: string | null
        }
        Insert: {
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          error_message?: string | null
          field_name: string
          glossary_applied?: boolean
          id?: string
          max_attempts?: number
          model_used?: string | null
          priority?: number
          processed_at?: string | null
          source_hash: string
          source_locale?: string
          source_text: string
          status?: string
          target_locale: string
          translated_text?: string | null
        }
        Update: {
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          error_message?: string | null
          field_name?: string
          glossary_applied?: boolean
          id?: string
          max_attempts?: number
          model_used?: string | null
          priority?: number
          processed_at?: string | null
          source_hash?: string
          source_locale?: string
          source_text?: string
          status?: string
          target_locale?: string
          translated_text?: string | null
        }
        Relationships: []
      }
      translation_requests: {
        Row: {
          created_at: string | null
          doc_kind: string
          id: string
          input_path: string | null
          last_error: string | null
          output_pdf_path: string | null
          provider: string | null
          source_lang: string | null
          status: string | null
          student_user_id: string
          target_lang: string | null
        }
        Insert: {
          created_at?: string | null
          doc_kind: string
          id?: string
          input_path?: string | null
          last_error?: string | null
          output_pdf_path?: string | null
          provider?: string | null
          source_lang?: string | null
          status?: string | null
          student_user_id: string
          target_lang?: string | null
        }
        Update: {
          created_at?: string | null
          doc_kind?: string
          id?: string
          input_path?: string | null
          last_error?: string | null
          output_pdf_path?: string | null
          provider?: string | null
          source_lang?: string | null
          status?: string | null
          student_user_id?: string
          target_lang?: string | null
        }
        Relationships: []
      }
      translation_templates: {
        Row: {
          body_html: string
          created_at: string | null
          id: string
          is_active: boolean | null
          kind: string
          locale: string | null
        }
        Insert: {
          body_html: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          kind: string
          locale?: string | null
        }
        Update: {
          body_html?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          kind?: string
          locale?: string | null
        }
        Relationships: []
      }
      tuition_change_proposals: {
        Row: {
          created_at: string | null
          decided_at: string | null
          decided_by: string | null
          diff_percent: number | null
          id: number
          new_snapshot: number | null
          old_snapshot: number | null
          reason: string | null
          status: string | null
          university_id: string | null
        }
        Insert: {
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          diff_percent?: number | null
          id?: number
          new_snapshot?: number | null
          old_snapshot?: number | null
          reason?: string | null
          status?: string | null
          university_id?: string | null
        }
        Update: {
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          diff_percent?: number | null
          id?: number
          new_snapshot?: number | null
          old_snapshot?: number | null
          reason?: string | null
          status?: string | null
          university_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tuition_change_proposals_new_snapshot_fkey"
            columns: ["new_snapshot"]
            isOneToOne: false
            referencedRelation: "tuition_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_change_proposals_old_snapshot_fkey"
            columns: ["old_snapshot"]
            isOneToOne: false
            referencedRelation: "tuition_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_change_proposals_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "tuition_change_proposals_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "tuition_change_proposals_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_change_proposals_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "tuition_change_proposals_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "tuition_change_proposals_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "tuition_change_proposals_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "tuition_change_proposals_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "tuition_change_proposals_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_change_proposals_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "tuition_change_proposals_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "tuition_change_proposals_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      tuition_consensus: {
        Row: {
          is_stale: boolean | null
          snapshot_id: number | null
          university_id: string
          updated_at: string | null
        }
        Insert: {
          is_stale?: boolean | null
          snapshot_id?: number | null
          university_id: string
          updated_at?: string | null
        }
        Update: {
          is_stale?: boolean | null
          snapshot_id?: number | null
          university_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tuition_consensus_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "tuition_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "tuition_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "tuition_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "tuition_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "tuition_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "tuition_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "tuition_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "tuition_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "tuition_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "tuition_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      tuition_snapshots: {
        Row: {
          academic_year: string | null
          amount: number | null
          amount_usd: number | null
          audience: string | null
          captured_at: string | null
          confidence: number | null
          content_hash: string | null
          currency: string | null
          degree_level: string | null
          id: number
          is_official: boolean | null
          source_name: string
          source_url: string
          university_id: string | null
        }
        Insert: {
          academic_year?: string | null
          amount?: number | null
          amount_usd?: number | null
          audience?: string | null
          captured_at?: string | null
          confidence?: number | null
          content_hash?: string | null
          currency?: string | null
          degree_level?: string | null
          id?: number
          is_official?: boolean | null
          source_name: string
          source_url: string
          university_id?: string | null
        }
        Update: {
          academic_year?: string | null
          amount?: number | null
          amount_usd?: number | null
          audience?: string | null
          captured_at?: string | null
          confidence?: number | null
          content_hash?: string | null
          currency?: string | null
          degree_level?: string | null
          id?: number
          is_official?: boolean | null
          source_name?: string
          source_url?: string
          university_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tuition_snapshots_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "tuition_snapshots_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "tuition_snapshots_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_snapshots_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "tuition_snapshots_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "tuition_snapshots_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "tuition_snapshots_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "tuition_snapshots_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "tuition_snapshots_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_snapshots_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "tuition_snapshots_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "tuition_snapshots_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      uni_sources: {
        Row: {
          created_at: string | null
          domain: string
          id: number
          notes: string | null
          robots_allowed: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          domain: string
          id?: number
          notes?: string | null
          robots_allowed?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string
          id?: number
          notes?: string | null
          robots_allowed?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      uniranks_crawl_jobs: {
        Row: {
          category: string
          completed_at: string | null
          created_at: string
          current_page: number
          error_message: string | null
          id: string
          last_activity_at: string | null
          max_pages: number
          started_at: string | null
          status: string
          total_found: number
          total_imported: number
        }
        Insert: {
          category: string
          completed_at?: string | null
          created_at?: string
          current_page?: number
          error_message?: string | null
          id?: string
          last_activity_at?: string | null
          max_pages?: number
          started_at?: string | null
          status?: string
          total_found?: number
          total_imported?: number
        }
        Update: {
          category?: string
          completed_at?: string | null
          created_at?: string
          current_page?: number
          error_message?: string | null
          id?: string
          last_activity_at?: string | null
          max_pages?: number
          started_at?: string | null
          status?: string
          total_found?: number
          total_imported?: number
        }
        Relationships: []
      }
      uniranks_crawl_state: {
        Row: {
          canonical_university_id: string | null
          created_at: string
          door2_run_id: string | null
          entity_type: string | null
          last_error_at: string | null
          last_ok_at: string | null
          locked_by: string | null
          locked_until: string | null
          parent_entity_id: string | null
          qs_slug: string | null
          quarantine_reason: string | null
          quarantined_at: string | null
          retry_budget: number
          retry_count: number
          source: string | null
          source_profile_url: string | null
          stage: string
          uniranks_profile_url: string | null
          university_id: string
          updated_at: string
        }
        Insert: {
          canonical_university_id?: string | null
          created_at?: string
          door2_run_id?: string | null
          entity_type?: string | null
          last_error_at?: string | null
          last_ok_at?: string | null
          locked_by?: string | null
          locked_until?: string | null
          parent_entity_id?: string | null
          qs_slug?: string | null
          quarantine_reason?: string | null
          quarantined_at?: string | null
          retry_budget?: number
          retry_count?: number
          source?: string | null
          source_profile_url?: string | null
          stage?: string
          uniranks_profile_url?: string | null
          university_id: string
          updated_at?: string
        }
        Update: {
          canonical_university_id?: string | null
          created_at?: string
          door2_run_id?: string | null
          entity_type?: string | null
          last_error_at?: string | null
          last_ok_at?: string | null
          locked_by?: string | null
          locked_until?: string | null
          parent_entity_id?: string | null
          qs_slug?: string | null
          quarantine_reason?: string | null
          quarantined_at?: string | null
          retry_budget?: number
          retry_count?: number
          source?: string | null
          source_profile_url?: string | null
          stage?: string
          uniranks_profile_url?: string | null
          university_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      uniranks_enrich_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          enriched: number
          error_message: string | null
          errors: number
          id: string
          last_activity_at: string | null
          processed: number
          programs_discovered: number
          programs_found: number
          programs_rejected: number
          programs_saved: number
          programs_valid: number
          rejection_reasons: Json
          source: string
          started_at: string | null
          status: string
          total_universities: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          enriched?: number
          error_message?: string | null
          errors?: number
          id?: string
          last_activity_at?: string | null
          processed?: number
          programs_discovered?: number
          programs_found?: number
          programs_rejected?: number
          programs_saved?: number
          programs_valid?: number
          rejection_reasons?: Json
          source?: string
          started_at?: string | null
          status?: string
          total_universities?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          enriched?: number
          error_message?: string | null
          errors?: number
          id?: string
          last_activity_at?: string | null
          processed?: number
          programs_discovered?: number
          programs_found?: number
          programs_rejected?: number
          programs_saved?: number
          programs_valid?: number
          rejection_reasons?: Json
          source?: string
          started_at?: string | null
          status?: string
          total_universities?: number
          updated_at?: string
        }
        Relationships: []
      }
      uniranks_import_runs: {
        Row: {
          catalog_upserts: number
          created_at: string
          finished_at: string | null
          id: string
          last_error: Json | null
          list_type: string
          pages_done: number
          started_at: string
          status: string
          trace_id: string
          university_upserts: number
        }
        Insert: {
          catalog_upserts?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          last_error?: Json | null
          list_type?: string
          pages_done?: number
          started_at?: string
          status?: string
          trace_id: string
          university_upserts?: number
        }
        Update: {
          catalog_upserts?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          last_error?: Json | null
          list_type?: string
          pages_done?: number
          started_at?: string
          status?: string
          trace_id?: string
          university_upserts?: number
        }
        Relationships: []
      }
      uniranks_page_snapshots: {
        Row: {
          content_hash: string | null
          created_at: string
          fetched_at: string
          id: number
          normalized_url: string
          page_type: string | null
          raw_html_ref: string | null
          raw_markdown: string | null
          status_code: number | null
          university_id: string
        }
        Insert: {
          content_hash?: string | null
          created_at?: string
          fetched_at?: string
          id?: never
          normalized_url: string
          page_type?: string | null
          raw_html_ref?: string | null
          raw_markdown?: string | null
          status_code?: number | null
          university_id: string
        }
        Update: {
          content_hash?: string | null
          created_at?: string
          fetched_at?: string
          id?: never
          normalized_url?: string
          page_type?: string | null
          raw_html_ref?: string | null
          raw_markdown?: string | null
          status_code?: number | null
          university_id?: string
        }
        Relationships: []
      }
      uniranks_step_runs: {
        Row: {
          created_at: string
          details_json: Json | null
          id: number
          section: string | null
          snapshot_id: number | null
          stage: string
          status: string
          step_key: string
          trace_id: string | null
          university_id: string
        }
        Insert: {
          created_at?: string
          details_json?: Json | null
          id?: never
          section?: string | null
          snapshot_id?: number | null
          stage: string
          status?: string
          step_key: string
          trace_id?: string | null
          university_id: string
        }
        Update: {
          created_at?: string
          details_json?: Json | null
          id?: never
          section?: string | null
          snapshot_id?: number | null
          stage?: string
          status?: string
          step_key?: string
          trace_id?: string | null
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "uniranks_step_runs_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "uniranks_page_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      uniranks_university_catalog: {
        Row: {
          country: string | null
          created_at: string
          id: string
          last_seen_at: string
          list_type: string
          logo_url: string | null
          match_status: string
          matched_university_id: string | null
          rank_position: number | null
          score: number | null
          snapshot_at: string
          uniranks_name: string
          uniranks_profile_url: string
          uniranks_slug: string
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          last_seen_at?: string
          list_type?: string
          logo_url?: string | null
          match_status?: string
          matched_university_id?: string | null
          rank_position?: number | null
          score?: number | null
          snapshot_at?: string
          uniranks_name: string
          uniranks_profile_url: string
          uniranks_slug: string
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          last_seen_at?: string
          list_type?: string
          logo_url?: string | null
          match_status?: string
          matched_university_id?: string | null
          rank_position?: number | null
          score?: number | null
          snapshot_at?: string
          uniranks_name?: string
          uniranks_profile_url?: string
          uniranks_slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "uniranks_university_catalog_matched_university_id_fkey"
            columns: ["matched_university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "uniranks_university_catalog_matched_university_id_fkey"
            columns: ["matched_university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "uniranks_university_catalog_matched_university_id_fkey"
            columns: ["matched_university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uniranks_university_catalog_matched_university_id_fkey"
            columns: ["matched_university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "uniranks_university_catalog_matched_university_id_fkey"
            columns: ["matched_university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "uniranks_university_catalog_matched_university_id_fkey"
            columns: ["matched_university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "uniranks_university_catalog_matched_university_id_fkey"
            columns: ["matched_university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "uniranks_university_catalog_matched_university_id_fkey"
            columns: ["matched_university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "uniranks_university_catalog_matched_university_id_fkey"
            columns: ["matched_university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uniranks_university_catalog_matched_university_id_fkey"
            columns: ["matched_university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "uniranks_university_catalog_matched_university_id_fkey"
            columns: ["matched_university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "uniranks_university_catalog_matched_university_id_fkey"
            columns: ["matched_university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      unis_assistant_events: {
        Row: {
          context: Json | null
          created_at: string | null
          duration_ms: number | null
          event_type: string
          id: string
          job_id: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          duration_ms?: number | null
          event_type: string
          id?: string
          job_id?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          duration_ms?: number | null
          event_type?: string
          id?: string
          job_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      unis_assistant_policies: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          rules: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          rules: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          rules?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      unis_assistant_review_items: {
        Row: {
          diff: Json | null
          id: number
          issues: string[] | null
          program_id: string | null
          review_id: number | null
        }
        Insert: {
          diff?: Json | null
          id?: number
          issues?: string[] | null
          program_id?: string | null
          review_id?: number | null
        }
        Update: {
          diff?: Json | null
          id?: number
          issues?: string[] | null
          program_id?: string | null
          review_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "unis_assistant_review_items_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "unis_assistant_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      unis_assistant_reviews: {
        Row: {
          confidence: number | null
          country_iso: string | null
          created_at: string
          decision: string | null
          id: number
          reasons: Json | null
          stats: Json | null
          university_id: string
          warnings: Json | null
        }
        Insert: {
          confidence?: number | null
          country_iso?: string | null
          created_at?: string
          decision?: string | null
          id?: number
          reasons?: Json | null
          stats?: Json | null
          university_id: string
          warnings?: Json | null
        }
        Update: {
          confidence?: number | null
          country_iso?: string | null
          created_at?: string
          decision?: string | null
          id?: number
          reasons?: Json | null
          stats?: Json | null
          university_id?: string
          warnings?: Json | null
        }
        Relationships: []
      }
      universities: {
        Row: {
          about_text: string | null
          acceptance_rate: number | null
          address: string | null
          annual_fees: number | null
          apply_url: string | null
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          contact_url: string | null
          content_hash: string | null
          country_code: string | null
          country_id: string | null
          crawl_error: string | null
          crawl_last_attempt: string | null
          crawl_stage: number | null
          crawl_status: string | null
          created_at: string | null
          cwur_education_rank: number | null
          cwur_employability_rank: number | null
          cwur_faculty_rank: number | null
          cwur_national_rank: number | null
          cwur_profile_url: string | null
          cwur_research_rank: number | null
          cwur_score: number | null
          cwur_world_rank: number | null
          cwur_year: number | null
          description: string | null
          description_ar: string | null
          display_order: number | null
          dorm_address: string | null
          dorm_currency_code: string | null
          dorm_lat: number | null
          dorm_lon: number | null
          dorm_price_monthly_local: number | null
          email: string | null
          enrolled_students: number | null
          faculty_count: number | null
          founded_year: number | null
          geo_confidence: number | null
          geo_lat: number | null
          geo_lon: number | null
          geo_source: string | null
          has_dorm: boolean | null
          hero_image_url: string | null
          id: string
          inquiry_url: string | null
          institution_type: string | null
          intl_student_count: number | null
          is_active: boolean | null
          last_scraped_at: string | null
          logo_source: string | null
          logo_updated_at: string | null
          logo_url: string | null
          main_image_url: string | null
          monthly_living: number | null
          name: string
          name_ar: string | null
          name_en: string | null
          page_lang: string | null
          partner_preferred: boolean | null
          phone: string | null
          programs_page_urls: string[] | null
          publish_status: string
          publish_trace_id: string | null
          published_at: string | null
          published_by: string | null
          qs_indicators: Json | null
          qs_overall_score: number | null
          qs_profile_url: string | null
          qs_ranking_year: number | null
          qs_regional_rank: number | null
          qs_slug: string | null
          qs_subject_rankings: Json | null
          qs_sustainability_rank: number | null
          qs_world_rank: number | null
          ranking: number | null
          rector_image_url: string | null
          rector_message: string | null
          rector_name: string | null
          rector_title: string | null
          seo_canonical_url: string | null
          seo_description: string | null
          seo_h1: string | null
          seo_index: boolean | null
          seo_last_reviewed_at: string | null
          seo_title: string | null
          show_in_home: boolean | null
          slug: string | null
          social_links: Json | null
          student_count: number | null
          student_portal_url: string | null
          tuition_max: number | null
          tuition_min: number | null
          uniranks_badges: string[] | null
          uniranks_country_rank: number | null
          uniranks_data_quality: string | null
          uniranks_last_reviewed_at: string | null
          uniranks_last_reviewed_by: string | null
          uniranks_last_trace_id: string | null
          uniranks_next_retry_at: string | null
          uniranks_profile_url: string | null
          uniranks_program_pages_done: number | null
          uniranks_program_pages_total: number | null
          uniranks_rank: number | null
          uniranks_recognized: boolean | null
          uniranks_region_label: string | null
          uniranks_region_rank: number | null
          uniranks_retry_count: number
          uniranks_score: number | null
          uniranks_sections_present: string[] | null
          uniranks_slug: string | null
          uniranks_snapshot: Json | null
          uniranks_snapshot_at: string | null
          uniranks_snapshot_hash: string | null
          uniranks_snapshot_trace_id: string | null
          uniranks_top_buckets: string[] | null
          uniranks_verified: boolean | null
          uniranks_world_rank: number | null
          university_type: string | null
          visit_url: string | null
          website: string | null
          website_confidence: number | null
          website_enrichment_job_id: string | null
          website_etld1: string | null
          website_host: string | null
          website_resolved_at: string | null
          website_source: string | null
        }
        Insert: {
          about_text?: string | null
          acceptance_rate?: number | null
          address?: string | null
          annual_fees?: number | null
          apply_url?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_url?: string | null
          content_hash?: string | null
          country_code?: string | null
          country_id?: string | null
          crawl_error?: string | null
          crawl_last_attempt?: string | null
          crawl_stage?: number | null
          crawl_status?: string | null
          created_at?: string | null
          cwur_education_rank?: number | null
          cwur_employability_rank?: number | null
          cwur_faculty_rank?: number | null
          cwur_national_rank?: number | null
          cwur_profile_url?: string | null
          cwur_research_rank?: number | null
          cwur_score?: number | null
          cwur_world_rank?: number | null
          cwur_year?: number | null
          description?: string | null
          description_ar?: string | null
          display_order?: number | null
          dorm_address?: string | null
          dorm_currency_code?: string | null
          dorm_lat?: number | null
          dorm_lon?: number | null
          dorm_price_monthly_local?: number | null
          email?: string | null
          enrolled_students?: number | null
          faculty_count?: number | null
          founded_year?: number | null
          geo_confidence?: number | null
          geo_lat?: number | null
          geo_lon?: number | null
          geo_source?: string | null
          has_dorm?: boolean | null
          hero_image_url?: string | null
          id?: string
          inquiry_url?: string | null
          institution_type?: string | null
          intl_student_count?: number | null
          is_active?: boolean | null
          last_scraped_at?: string | null
          logo_source?: string | null
          logo_updated_at?: string | null
          logo_url?: string | null
          main_image_url?: string | null
          monthly_living?: number | null
          name: string
          name_ar?: string | null
          name_en?: string | null
          page_lang?: string | null
          partner_preferred?: boolean | null
          phone?: string | null
          programs_page_urls?: string[] | null
          publish_status?: string
          publish_trace_id?: string | null
          published_at?: string | null
          published_by?: string | null
          qs_indicators?: Json | null
          qs_overall_score?: number | null
          qs_profile_url?: string | null
          qs_ranking_year?: number | null
          qs_regional_rank?: number | null
          qs_slug?: string | null
          qs_subject_rankings?: Json | null
          qs_sustainability_rank?: number | null
          qs_world_rank?: number | null
          ranking?: number | null
          rector_image_url?: string | null
          rector_message?: string | null
          rector_name?: string | null
          rector_title?: string | null
          seo_canonical_url?: string | null
          seo_description?: string | null
          seo_h1?: string | null
          seo_index?: boolean | null
          seo_last_reviewed_at?: string | null
          seo_title?: string | null
          show_in_home?: boolean | null
          slug?: string | null
          social_links?: Json | null
          student_count?: number | null
          student_portal_url?: string | null
          tuition_max?: number | null
          tuition_min?: number | null
          uniranks_badges?: string[] | null
          uniranks_country_rank?: number | null
          uniranks_data_quality?: string | null
          uniranks_last_reviewed_at?: string | null
          uniranks_last_reviewed_by?: string | null
          uniranks_last_trace_id?: string | null
          uniranks_next_retry_at?: string | null
          uniranks_profile_url?: string | null
          uniranks_program_pages_done?: number | null
          uniranks_program_pages_total?: number | null
          uniranks_rank?: number | null
          uniranks_recognized?: boolean | null
          uniranks_region_label?: string | null
          uniranks_region_rank?: number | null
          uniranks_retry_count?: number
          uniranks_score?: number | null
          uniranks_sections_present?: string[] | null
          uniranks_slug?: string | null
          uniranks_snapshot?: Json | null
          uniranks_snapshot_at?: string | null
          uniranks_snapshot_hash?: string | null
          uniranks_snapshot_trace_id?: string | null
          uniranks_top_buckets?: string[] | null
          uniranks_verified?: boolean | null
          uniranks_world_rank?: number | null
          university_type?: string | null
          visit_url?: string | null
          website?: string | null
          website_confidence?: number | null
          website_enrichment_job_id?: string | null
          website_etld1?: string | null
          website_host?: string | null
          website_resolved_at?: string | null
          website_source?: string | null
        }
        Update: {
          about_text?: string | null
          acceptance_rate?: number | null
          address?: string | null
          annual_fees?: number | null
          apply_url?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_url?: string | null
          content_hash?: string | null
          country_code?: string | null
          country_id?: string | null
          crawl_error?: string | null
          crawl_last_attempt?: string | null
          crawl_stage?: number | null
          crawl_status?: string | null
          created_at?: string | null
          cwur_education_rank?: number | null
          cwur_employability_rank?: number | null
          cwur_faculty_rank?: number | null
          cwur_national_rank?: number | null
          cwur_profile_url?: string | null
          cwur_research_rank?: number | null
          cwur_score?: number | null
          cwur_world_rank?: number | null
          cwur_year?: number | null
          description?: string | null
          description_ar?: string | null
          display_order?: number | null
          dorm_address?: string | null
          dorm_currency_code?: string | null
          dorm_lat?: number | null
          dorm_lon?: number | null
          dorm_price_monthly_local?: number | null
          email?: string | null
          enrolled_students?: number | null
          faculty_count?: number | null
          founded_year?: number | null
          geo_confidence?: number | null
          geo_lat?: number | null
          geo_lon?: number | null
          geo_source?: string | null
          has_dorm?: boolean | null
          hero_image_url?: string | null
          id?: string
          inquiry_url?: string | null
          institution_type?: string | null
          intl_student_count?: number | null
          is_active?: boolean | null
          last_scraped_at?: string | null
          logo_source?: string | null
          logo_updated_at?: string | null
          logo_url?: string | null
          main_image_url?: string | null
          monthly_living?: number | null
          name?: string
          name_ar?: string | null
          name_en?: string | null
          page_lang?: string | null
          partner_preferred?: boolean | null
          phone?: string | null
          programs_page_urls?: string[] | null
          publish_status?: string
          publish_trace_id?: string | null
          published_at?: string | null
          published_by?: string | null
          qs_indicators?: Json | null
          qs_overall_score?: number | null
          qs_profile_url?: string | null
          qs_ranking_year?: number | null
          qs_regional_rank?: number | null
          qs_slug?: string | null
          qs_subject_rankings?: Json | null
          qs_sustainability_rank?: number | null
          qs_world_rank?: number | null
          ranking?: number | null
          rector_image_url?: string | null
          rector_message?: string | null
          rector_name?: string | null
          rector_title?: string | null
          seo_canonical_url?: string | null
          seo_description?: string | null
          seo_h1?: string | null
          seo_index?: boolean | null
          seo_last_reviewed_at?: string | null
          seo_title?: string | null
          show_in_home?: boolean | null
          slug?: string | null
          social_links?: Json | null
          student_count?: number | null
          student_portal_url?: string | null
          tuition_max?: number | null
          tuition_min?: number | null
          uniranks_badges?: string[] | null
          uniranks_country_rank?: number | null
          uniranks_data_quality?: string | null
          uniranks_last_reviewed_at?: string | null
          uniranks_last_reviewed_by?: string | null
          uniranks_last_trace_id?: string | null
          uniranks_next_retry_at?: string | null
          uniranks_profile_url?: string | null
          uniranks_program_pages_done?: number | null
          uniranks_program_pages_total?: number | null
          uniranks_rank?: number | null
          uniranks_recognized?: boolean | null
          uniranks_region_label?: string | null
          uniranks_region_rank?: number | null
          uniranks_retry_count?: number
          uniranks_score?: number | null
          uniranks_sections_present?: string[] | null
          uniranks_slug?: string | null
          uniranks_snapshot?: Json | null
          uniranks_snapshot_at?: string | null
          uniranks_snapshot_hash?: string | null
          uniranks_snapshot_trace_id?: string | null
          uniranks_top_buckets?: string[] | null
          uniranks_verified?: boolean | null
          uniranks_world_rank?: number | null
          university_type?: string | null
          visit_url?: string | null
          website?: string | null
          website_confidence?: number | null
          website_enrichment_job_id?: string | null
          website_etld1?: string | null
          website_host?: string | null
          website_resolved_at?: string | null
          website_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "universities_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "universities_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_events_search"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "universities_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "universities_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "universities_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "universities_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_scholarship_search"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "universities_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "universities_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["country_id"]
          },
          {
            foreignKeyName: "universities_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["country_id"]
          },
        ]
      }
      university_aliases: {
        Row: {
          alias: string
          alias_normalized: string | null
          created_at: string
          id: string
          lang_code: string
          priority: number
          source: string | null
          university_id: string
        }
        Insert: {
          alias: string
          alias_normalized?: string | null
          created_at?: string
          id?: string
          lang_code: string
          priority?: number
          source?: string | null
          university_id: string
        }
        Update: {
          alias?: string
          alias_normalized?: string | null
          created_at?: string
          id?: string
          lang_code?: string
          priority?: number
          source?: string | null
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_aliases_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_aliases_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_aliases_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_aliases_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_aliases_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_aliases_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_aliases_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_aliases_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "university_aliases_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_aliases_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_aliases_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_aliases_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      university_comment_moderation: {
        Row: {
          acted_by: string
          action: Database["public"]["Enums"]["comment_mod_action"]
          comment_id: string
          created_at: string
          id: string
          reason: string | null
        }
        Insert: {
          acted_by: string
          action: Database["public"]["Enums"]["comment_mod_action"]
          comment_id: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Update: {
          acted_by?: string
          action?: Database["public"]["Enums"]["comment_mod_action"]
          comment_id?: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "university_comment_moderation_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "university_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      university_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          reply_as_university: boolean
          university_id: string | null
          updated_at: string
          user_id: string
          visible: boolean
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          reply_as_university?: boolean
          university_id?: string | null
          updated_at?: string
          user_id: string
          visible?: boolean
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          reply_as_university?: boolean
          university_id?: string | null
          updated_at?: string
          user_id?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "university_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "university_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "university_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_comments_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_comments_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_comments_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_comments_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_comments_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_comments_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_comments_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_comments_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "university_comments_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_comments_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_comments_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_comments_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      university_draft: {
        Row: {
          city: string | null
          confidence_score: number | null
          content_hash: string | null
          country: string
          country_code: string | null
          created_at: string | null
          description: string | null
          hero_image_url: string | null
          id: number
          logo_url: string | null
          name: string
          name_en: string | null
          ranking: number | null
          slug: string | null
          source_urls: string[] | null
          status: string | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          city?: string | null
          confidence_score?: number | null
          content_hash?: string | null
          country: string
          country_code?: string | null
          created_at?: string | null
          description?: string | null
          hero_image_url?: string | null
          id?: number
          logo_url?: string | null
          name: string
          name_en?: string | null
          ranking?: number | null
          slug?: string | null
          source_urls?: string[] | null
          status?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          city?: string | null
          confidence_score?: number | null
          content_hash?: string | null
          country?: string
          country_code?: string | null
          created_at?: string | null
          description?: string | null
          hero_image_url?: string | null
          id?: number
          logo_url?: string | null
          name?: string
          name_en?: string | null
          ranking?: number | null
          slug?: string | null
          source_urls?: string[] | null
          status?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      university_duplicates: {
        Row: {
          canonical_university_id: string
          created_at: string
          duplicate_university_id: string
          id: string
          reason: string | null
          status: string
        }
        Insert: {
          canonical_university_id: string
          created_at?: string
          duplicate_university_id: string
          id?: string
          reason?: string | null
          status?: string
        }
        Update: {
          canonical_university_id?: string
          created_at?: string
          duplicate_university_id?: string
          id?: string
          reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_duplicates_canonical_university_id_fkey"
            columns: ["canonical_university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_duplicates_canonical_university_id_fkey"
            columns: ["canonical_university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_duplicates_canonical_university_id_fkey"
            columns: ["canonical_university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_duplicates_canonical_university_id_fkey"
            columns: ["canonical_university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_duplicates_canonical_university_id_fkey"
            columns: ["canonical_university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_duplicates_canonical_university_id_fkey"
            columns: ["canonical_university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_duplicates_canonical_university_id_fkey"
            columns: ["canonical_university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_duplicates_canonical_university_id_fkey"
            columns: ["canonical_university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "university_duplicates_canonical_university_id_fkey"
            columns: ["canonical_university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_duplicates_canonical_university_id_fkey"
            columns: ["canonical_university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_duplicates_canonical_university_id_fkey"
            columns: ["canonical_university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_duplicates_canonical_university_id_fkey"
            columns: ["canonical_university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_duplicates_duplicate_university_id_fkey"
            columns: ["duplicate_university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_duplicates_duplicate_university_id_fkey"
            columns: ["duplicate_university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_duplicates_duplicate_university_id_fkey"
            columns: ["duplicate_university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_duplicates_duplicate_university_id_fkey"
            columns: ["duplicate_university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_duplicates_duplicate_university_id_fkey"
            columns: ["duplicate_university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_duplicates_duplicate_university_id_fkey"
            columns: ["duplicate_university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_duplicates_duplicate_university_id_fkey"
            columns: ["duplicate_university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_duplicates_duplicate_university_id_fkey"
            columns: ["duplicate_university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "university_duplicates_duplicate_university_id_fkey"
            columns: ["duplicate_university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_duplicates_duplicate_university_id_fkey"
            columns: ["duplicate_university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_duplicates_duplicate_university_id_fkey"
            columns: ["duplicate_university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_duplicates_duplicate_university_id_fkey"
            columns: ["duplicate_university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      university_enrichment_draft: {
        Row: {
          attempt_count: number
          confidence: number | null
          created_at: string
          evidence_snippet: string | null
          field_name: string
          finalized_at: string | null
          id: string
          last_attempted_at: string | null
          max_attempts: number
          next_retry_after: string | null
          proposed_value: string | null
          published_at: string | null
          published_by: string | null
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_name: string
          source_url: string | null
          status: string
          trace_id: string | null
          university_id: string
          worker_version: string | null
        }
        Insert: {
          attempt_count?: number
          confidence?: number | null
          created_at?: string
          evidence_snippet?: string | null
          field_name: string
          finalized_at?: string | null
          id?: string
          last_attempted_at?: string | null
          max_attempts?: number
          next_retry_after?: string | null
          proposed_value?: string | null
          published_at?: string | null
          published_by?: string | null
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_name: string
          source_url?: string | null
          status?: string
          trace_id?: string | null
          university_id: string
          worker_version?: string | null
        }
        Update: {
          attempt_count?: number
          confidence?: number | null
          created_at?: string
          evidence_snippet?: string | null
          field_name?: string
          finalized_at?: string | null
          id?: string
          last_attempted_at?: string | null
          max_attempts?: number
          next_retry_after?: string | null
          proposed_value?: string | null
          published_at?: string | null
          published_by?: string | null
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_name?: string
          source_url?: string | null
          status?: string
          trace_id?: string | null
          university_id?: string
          worker_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "university_enrichment_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_enrichment_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_enrichment_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_enrichment_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_enrichment_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_enrichment_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_enrichment_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_enrichment_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "university_enrichment_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_enrichment_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_enrichment_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_enrichment_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      university_external_ids: {
        Row: {
          canonical_source_url: string | null
          created_at: string
          display_name: string | null
          enrichment_status: string | null
          external_id: string | null
          first_seen_at: string
          id: string
          is_primary_for_source: boolean
          last_seen_at: string
          match_confidence: number | null
          match_method: string | null
          phases_done: string[] | null
          source_name: string
          source_url: string
          trace_id: string | null
          university_id: string | null
          updated_at: string
        }
        Insert: {
          canonical_source_url?: string | null
          created_at?: string
          display_name?: string | null
          enrichment_status?: string | null
          external_id?: string | null
          first_seen_at?: string
          id?: string
          is_primary_for_source?: boolean
          last_seen_at?: string
          match_confidence?: number | null
          match_method?: string | null
          phases_done?: string[] | null
          source_name: string
          source_url: string
          trace_id?: string | null
          university_id?: string | null
          updated_at?: string
        }
        Update: {
          canonical_source_url?: string | null
          created_at?: string
          display_name?: string | null
          enrichment_status?: string | null
          external_id?: string | null
          first_seen_at?: string
          id?: string
          is_primary_for_source?: boolean
          last_seen_at?: string
          match_confidence?: number | null
          match_method?: string | null
          phases_done?: string[] | null
          source_name?: string
          source_url?: string
          trace_id?: string | null
          university_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_external_ids_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_external_ids_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_external_ids_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_external_ids_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_external_ids_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_external_ids_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_external_ids_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_external_ids_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "university_external_ids_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_external_ids_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_external_ids_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_external_ids_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      university_field_provenance: {
        Row: {
          confidence: number | null
          enrichment_draft_id: string | null
          field_name: string
          source_name: string
          source_url: string | null
          trace_id: string | null
          university_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          confidence?: number | null
          enrichment_draft_id?: string | null
          field_name: string
          source_name: string
          source_url?: string | null
          trace_id?: string | null
          university_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          confidence?: number | null
          enrichment_draft_id?: string | null
          field_name?: string
          source_name?: string
          source_url?: string | null
          trace_id?: string | null
          university_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "university_field_provenance_enrichment_draft_id_fkey"
            columns: ["enrichment_draft_id"]
            isOneToOne: false
            referencedRelation: "university_enrichment_draft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_field_provenance_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_field_provenance_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_field_provenance_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_field_provenance_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_field_provenance_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_field_provenance_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_field_provenance_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_field_provenance_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "university_field_provenance_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_field_provenance_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_field_provenance_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_field_provenance_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      university_geo_evidence: {
        Row: {
          confidence: number | null
          content_hash: string | null
          created_at: string
          detected_address: string | null
          detected_city: string | null
          detected_country_code: string | null
          detected_lat: number | null
          detected_lon: number | null
          entity_scope: string | null
          entity_type: string
          id: string
          job_id: string | null
          raw_data: Json | null
          raw_excerpt: string | null
          signals: Json | null
          source_type: string
          source_url: string | null
          university_id: string
        }
        Insert: {
          confidence?: number | null
          content_hash?: string | null
          created_at?: string
          detected_address?: string | null
          detected_city?: string | null
          detected_country_code?: string | null
          detected_lat?: number | null
          detected_lon?: number | null
          entity_scope?: string | null
          entity_type: string
          id?: string
          job_id?: string | null
          raw_data?: Json | null
          raw_excerpt?: string | null
          signals?: Json | null
          source_type: string
          source_url?: string | null
          university_id: string
        }
        Update: {
          confidence?: number | null
          content_hash?: string | null
          created_at?: string
          detected_address?: string | null
          detected_city?: string | null
          detected_country_code?: string | null
          detected_lat?: number | null
          detected_lon?: number | null
          entity_scope?: string | null
          entity_type?: string
          id?: string
          job_id?: string | null
          raw_data?: Json | null
          raw_excerpt?: string | null
          signals?: Json | null
          source_type?: string
          source_url?: string | null
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_geo_evidence_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "geo_verification_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_geo_evidence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_geo_evidence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_geo_evidence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_geo_evidence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_geo_evidence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_geo_evidence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_geo_evidence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_geo_evidence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "university_geo_evidence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_geo_evidence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_geo_evidence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_geo_evidence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      university_geo_matches: {
        Row: {
          city_name: string
          country_code: string
          id: string
          lat: number | null
          lon: number | null
          match_confidence: number | null
          match_status: string
          matched_name: string | null
          osm_id: number | null
          osm_type: string | null
          provider: string
          query_version: string | null
          raw_json: Json | null
          resolved_at: string | null
          university_id: string
        }
        Insert: {
          city_name: string
          country_code: string
          id?: string
          lat?: number | null
          lon?: number | null
          match_confidence?: number | null
          match_status?: string
          matched_name?: string | null
          osm_id?: number | null
          osm_type?: string | null
          provider?: string
          query_version?: string | null
          raw_json?: Json | null
          resolved_at?: string | null
          university_id: string
        }
        Update: {
          city_name?: string
          country_code?: string
          id?: string
          lat?: number | null
          lon?: number | null
          match_confidence?: number | null
          match_status?: string
          matched_name?: string | null
          osm_id?: number | null
          osm_type?: string | null
          provider?: string
          query_version?: string | null
          raw_json?: Json | null
          resolved_at?: string | null
          university_id?: string
        }
        Relationships: []
      }
      university_housing: {
        Row: {
          accommodation_during_exams: boolean | null
          address: string | null
          capacity_total: number | null
          confidence: number | null
          contact_hours: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          dormitories_count: number | null
          facilities: Json | null
          fetched_at: string | null
          gender_policy: string | null
          geo_source: string | null
          housing_type: string
          id: string
          lat: number | null
          lon: number | null
          on_campus: boolean
          parser_version: string | null
          pricing_notes: string | null
          required_documents: Json | null
          settlement_conditions: Json | null
          source_name: string | null
          source_url: string | null
          summary: string | null
          temporary_accommodation: boolean | null
          title: string | null
          trace_id: string | null
          university_id: string
          updated_at: string
        }
        Insert: {
          accommodation_during_exams?: boolean | null
          address?: string | null
          capacity_total?: number | null
          confidence?: number | null
          contact_hours?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          dormitories_count?: number | null
          facilities?: Json | null
          fetched_at?: string | null
          gender_policy?: string | null
          geo_source?: string | null
          housing_type?: string
          id?: string
          lat?: number | null
          lon?: number | null
          on_campus?: boolean
          parser_version?: string | null
          pricing_notes?: string | null
          required_documents?: Json | null
          settlement_conditions?: Json | null
          source_name?: string | null
          source_url?: string | null
          summary?: string | null
          temporary_accommodation?: boolean | null
          title?: string | null
          trace_id?: string | null
          university_id: string
          updated_at?: string
        }
        Update: {
          accommodation_during_exams?: boolean | null
          address?: string | null
          capacity_total?: number | null
          confidence?: number | null
          contact_hours?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          dormitories_count?: number | null
          facilities?: Json | null
          fetched_at?: string | null
          gender_policy?: string | null
          geo_source?: string | null
          housing_type?: string
          id?: string
          lat?: number | null
          lon?: number | null
          on_campus?: boolean
          parser_version?: string | null
          pricing_notes?: string | null
          required_documents?: Json | null
          settlement_conditions?: Json | null
          source_name?: string | null
          source_url?: string | null
          summary?: string | null
          temporary_accommodation?: boolean | null
          title?: string | null
          trace_id?: string | null
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_housing_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_housing_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_housing_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_housing_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_housing_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_housing_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_housing_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_housing_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "university_housing_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_housing_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_housing_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_housing_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      university_housing_locations: {
        Row: {
          address: string | null
          city: string | null
          confidence: number | null
          country_code: string | null
          created_at: string
          currency_code: string | null
          id: string
          is_primary: boolean
          lat: number | null
          lon: number | null
          name: string | null
          price_monthly_local: number | null
          raw_data: Json | null
          source_url: string | null
          status: string
          university_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          confidence?: number | null
          country_code?: string | null
          created_at?: string
          currency_code?: string | null
          id?: string
          is_primary?: boolean
          lat?: number | null
          lon?: number | null
          name?: string | null
          price_monthly_local?: number | null
          raw_data?: Json | null
          source_url?: string | null
          status?: string
          university_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          confidence?: number | null
          country_code?: string | null
          created_at?: string
          currency_code?: string | null
          id?: string
          is_primary?: boolean
          lat?: number | null
          lon?: number | null
          name?: string | null
          price_monthly_local?: number | null
          raw_data?: Json | null
          source_url?: string | null
          status?: string
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_housing_locations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_housing_locations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_housing_locations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_housing_locations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_housing_locations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_housing_locations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_housing_locations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_housing_locations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "university_housing_locations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_housing_locations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_housing_locations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_housing_locations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      university_i18n: {
        Row: {
          description: string | null
          highlights: Json | null
          lang_code: string
          name: string | null
          quality_score: number
          source: string | null
          university_id: string
          updated_at: string
        }
        Insert: {
          description?: string | null
          highlights?: Json | null
          lang_code: string
          name?: string | null
          quality_score?: number
          source?: string | null
          university_id: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          highlights?: Json | null
          lang_code?: string
          name?: string | null
          quality_score?: number
          source?: string | null
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_i18n_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_i18n_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_i18n_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_i18n_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_i18n_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_i18n_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_i18n_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_i18n_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "university_i18n_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_i18n_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_i18n_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_i18n_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      university_import_staging: {
        Row: {
          city: string | null
          country_code: string | null
          country_name: string | null
          created_at: string | null
          error_message: string | null
          external_id: string
          id: string
          imported_at: string | null
          is_verified: boolean | null
          logo_url: string | null
          matched_university_id: string | null
          name: string
          name_en: string | null
          processed_at: string | null
          rank: number | null
          raw_data: Json | null
          score: number | null
          source: string
          status: string | null
          tier: string | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          city?: string | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string | null
          error_message?: string | null
          external_id: string
          id?: string
          imported_at?: string | null
          is_verified?: boolean | null
          logo_url?: string | null
          matched_university_id?: string | null
          name: string
          name_en?: string | null
          processed_at?: string | null
          rank?: number | null
          raw_data?: Json | null
          score?: number | null
          source: string
          status?: string | null
          tier?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          city?: string | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string | null
          error_message?: string | null
          external_id?: string
          id?: string
          imported_at?: string | null
          is_verified?: boolean | null
          logo_url?: string | null
          matched_university_id?: string | null
          name?: string
          name_en?: string | null
          processed_at?: string | null
          rank?: number | null
          raw_data?: Json | null
          score?: number | null
          source?: string
          status?: string | null
          tier?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      university_inbox_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          is_university_reply: boolean
          read_at: string | null
          sender_id: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_university_reply?: boolean
          read_at?: string | null
          sender_id: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_university_reply?: boolean
          read_at?: string | null
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_inbox_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "university_inbox_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      university_inbox_threads: {
        Row: {
          assigned_to: string | null
          created_at: string
          id: string
          status: Database["public"]["Enums"]["inbox_thread_status"]
          subject: string
          university_id: string
          updated_at: string
          visitor_user_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["inbox_thread_status"]
          subject?: string
          university_id: string
          updated_at?: string
          visitor_user_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["inbox_thread_status"]
          subject?: string
          university_id?: string
          updated_at?: string
          visitor_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_inbox_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_inbox_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_inbox_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_inbox_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_inbox_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_inbox_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_inbox_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_inbox_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "university_inbox_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_inbox_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_inbox_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_inbox_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      university_media: {
        Row: {
          alt_text: string | null
          created_at: string
          fetched_at: string | null
          height: number | null
          housing_id: string | null
          id: string
          image_type: string
          is_primary: boolean
          media_kind: string
          parser_version: string | null
          program_id: string | null
          public_url: string | null
          sha256: string | null
          sort_order: number
          source_name: string | null
          source_page_url: string
          source_url: string
          storage_bucket: string | null
          storage_path: string | null
          trace_id: string | null
          university_id: string
          updated_at: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          fetched_at?: string | null
          height?: number | null
          housing_id?: string | null
          id?: string
          image_type?: string
          is_primary?: boolean
          media_kind?: string
          parser_version?: string | null
          program_id?: string | null
          public_url?: string | null
          sha256?: string | null
          sort_order?: number
          source_name?: string | null
          source_page_url?: string
          source_url: string
          storage_bucket?: string | null
          storage_path?: string | null
          trace_id?: string | null
          university_id: string
          updated_at?: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          fetched_at?: string | null
          height?: number | null
          housing_id?: string | null
          id?: string
          image_type?: string
          is_primary?: boolean
          media_kind?: string
          parser_version?: string | null
          program_id?: string | null
          public_url?: string | null
          sha256?: string | null
          sort_order?: number
          source_name?: string | null
          source_page_url?: string
          source_url?: string
          storage_bucket?: string | null
          storage_path?: string | null
          trace_id?: string | null
          university_id?: string
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_university_media_housing"
            columns: ["housing_id"]
            isOneToOne: false
            referencedRelation: "university_housing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_media_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "university_media_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_media_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "university_media_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "university_media_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "university_media_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "university_media_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "university_media_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "university_media_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_media_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_media_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_media_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_media_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_media_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_media_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_media_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "university_media_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_media_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_media_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_media_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      university_media_suggestions: {
        Row: {
          ai_confidence: number | null
          ai_detected_content: string | null
          ai_latency_ms: number | null
          ai_model: string | null
          ai_provider: string | null
          ai_reasoning: string | null
          ai_recommendation: string | null
          ai_validated: boolean | null
          alternative_urls: Json | null
          confidence_score: number | null
          created_at: string
          height: number | null
          id: string
          image_data: string | null
          image_url: string
          image_url_hash: string | null
          media_type: string
          original_url: string | null
          quality: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          search_query: string | null
          source: string | null
          status: string
          university_id: string
          updated_at: string
          width: number | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_detected_content?: string | null
          ai_latency_ms?: number | null
          ai_model?: string | null
          ai_provider?: string | null
          ai_reasoning?: string | null
          ai_recommendation?: string | null
          ai_validated?: boolean | null
          alternative_urls?: Json | null
          confidence_score?: number | null
          created_at?: string
          height?: number | null
          id?: string
          image_data?: string | null
          image_url: string
          image_url_hash?: string | null
          media_type: string
          original_url?: string | null
          quality?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          search_query?: string | null
          source?: string | null
          status?: string
          university_id: string
          updated_at?: string
          width?: number | null
        }
        Update: {
          ai_confidence?: number | null
          ai_detected_content?: string | null
          ai_latency_ms?: number | null
          ai_model?: string | null
          ai_provider?: string | null
          ai_reasoning?: string | null
          ai_recommendation?: string | null
          ai_validated?: boolean | null
          alternative_urls?: Json | null
          confidence_score?: number | null
          created_at?: string
          height?: number | null
          id?: string
          image_data?: string | null
          image_url?: string
          image_url_hash?: string | null
          media_type?: string
          original_url?: string | null
          quality?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          search_query?: string | null
          source?: string | null
          status?: string
          university_id?: string
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "university_media_suggestions_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_media_suggestions_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_media_suggestions_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_media_suggestions_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_media_suggestions_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_media_suggestions_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_media_suggestions_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_media_suggestions_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "university_media_suggestions_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_media_suggestions_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_media_suggestions_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_media_suggestions_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      university_offices: {
        Row: {
          confidence: number | null
          created_at: string | null
          email: string | null
          evidence_snippet: string | null
          id: string
          location: string | null
          name: string | null
          notes: string | null
          office_hours: string | null
          office_type: string
          phone: string | null
          review_status: string | null
          source_type: string | null
          source_url: string | null
          university_id: string
          updated_at: string | null
          url: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          email?: string | null
          evidence_snippet?: string | null
          id?: string
          location?: string | null
          name?: string | null
          notes?: string | null
          office_hours?: string | null
          office_type: string
          phone?: string | null
          review_status?: string | null
          source_type?: string | null
          source_url?: string | null
          university_id: string
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          email?: string | null
          evidence_snippet?: string | null
          id?: string
          location?: string | null
          name?: string | null
          notes?: string | null
          office_hours?: string | null
          office_type?: string
          phone?: string | null
          review_status?: string | null
          source_type?: string | null
          source_url?: string | null
          university_id?: string
          updated_at?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "university_offices_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_offices_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_offices_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_offices_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_offices_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_offices_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_offices_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_offices_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "university_offices_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_offices_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_offices_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_offices_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      university_page_analytics: {
        Row: {
          created_at: string
          event_type: string
          id: number
          metadata: Json | null
          university_id: string
          user_id: string | null
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: never
          metadata?: Json | null
          university_id: string
          user_id?: string | null
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: never
          metadata?: Json | null
          university_id?: string
          user_id?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "university_page_analytics_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_analytics_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_analytics_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_page_analytics_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_analytics_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_analytics_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_analytics_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_analytics_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "university_page_analytics_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_page_analytics_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_analytics_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_analytics_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      university_page_inbox_messages: {
        Row: {
          created_at: string
          id: string
          message_body: string
          sender_user_id: string | null
          thread_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_body: string
          sender_user_id?: string | null
          thread_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_body?: string
          sender_user_id?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_page_inbox_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "university_page_inbox_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      university_page_inbox_threads: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          subject: string | null
          university_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          subject?: string | null
          university_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          subject?: string | null
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_page_inbox_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_inbox_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_inbox_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_page_inbox_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_inbox_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_inbox_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_inbox_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_inbox_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "university_page_inbox_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_page_inbox_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_inbox_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_inbox_threads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      university_page_members: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          role_id: string
          university_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          role_id: string
          university_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          role_id?: string
          university_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_page_members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "university_page_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_page_members_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_members_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_members_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_page_members_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_members_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_members_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_members_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_members_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "university_page_members_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_page_members_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_members_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_members_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      university_page_post_media: {
        Row: {
          created_at: string
          id: string
          media_kind: string
          media_url: string
          post_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          media_kind?: string
          media_url: string
          post_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          media_kind?: string
          media_url?: string
          post_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "university_page_post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "university_page_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      university_page_posts: {
        Row: {
          author_user_id: string | null
          content: string
          created_at: string
          id: string
          status: string
          university_id: string
          updated_at: string
        }
        Insert: {
          author_user_id?: string | null
          content: string
          created_at?: string
          id?: string
          status?: string
          university_id: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string | null
          content?: string
          created_at?: string
          id?: string
          status?: string
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_page_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_page_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "university_page_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_page_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      university_page_roles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          role_key: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          role_key: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          role_key?: string
        }
        Relationships: []
      }
      university_page_settings: {
        Row: {
          id: string
          key: string
          university_id: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          university_id: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          university_id?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "university_page_settings_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_settings_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_settings_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_page_settings_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_settings_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_settings_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_settings_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_settings_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "university_page_settings_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_page_settings_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_settings_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_settings_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      university_page_spaces: {
        Row: {
          created_at: string
          page_space_id: number
          sync_enabled: boolean
          university_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          page_space_id: number
          sync_enabled?: boolean
          university_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          page_space_id?: number
          sync_enabled?: boolean
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_page_spaces_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_spaces_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_spaces_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_page_spaces_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_spaces_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_spaces_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_spaces_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_spaces_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "university_page_spaces_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_page_spaces_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_spaces_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_spaces_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: true
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      university_page_staff: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["university_page_role"]
          status: string
          university_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["university_page_role"]
          status?: string
          university_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["university_page_role"]
          status?: string
          university_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_page_staff_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_staff_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_staff_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_page_staff_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_staff_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_staff_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_staff_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_staff_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "university_page_staff_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_page_staff_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_staff_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_page_staff_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      university_page_staff_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by_user_id: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          intended_role: string
          invited_by: string
          revoked_at: string | null
          revoked_by: string | null
          status: string
          token_hash: string
          university_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          intended_role: string
          invited_by: string
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          token_hash: string
          university_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          intended_role?: string
          invited_by?: string
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          token_hash?: string
          university_id?: string
        }
        Relationships: []
      }
      university_post_reactions: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reaction_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "university_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      university_posts: {
        Row: {
          archived_at: string | null
          attachments: Json | null
          author_id: string
          body: string
          created_at: string
          id: string
          metadata: Json | null
          pinned: boolean
          post_type: Database["public"]["Enums"]["university_post_type"]
          published_at: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["university_post_status"]
          title: string | null
          university_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          attachments?: Json | null
          author_id: string
          body: string
          created_at?: string
          id?: string
          metadata?: Json | null
          pinned?: boolean
          post_type?: Database["public"]["Enums"]["university_post_type"]
          published_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["university_post_status"]
          title?: string | null
          university_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          attachments?: Json | null
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          pinned?: boolean
          post_type?: Database["public"]["Enums"]["university_post_type"]
          published_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["university_post_status"]
          title?: string | null
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "university_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_posts_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      university_program_intelligence: {
        Row: {
          breakdown: Json | null
          computed_at: string | null
          id: string
          metric_key: string
          metric_value: number
          period: string
          program_id: string | null
          university_id: string
        }
        Insert: {
          breakdown?: Json | null
          computed_at?: string | null
          id?: string
          metric_key: string
          metric_value?: number
          period: string
          program_id?: string | null
          university_id: string
        }
        Update: {
          breakdown?: Json | null
          computed_at?: string | null
          id?: string
          metric_key?: string
          metric_value?: number
          period?: string
          program_id?: string | null
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_program_intelligence_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "university_program_intelligence_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_program_intelligence_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "university_program_intelligence_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "university_program_intelligence_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "university_program_intelligence_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "university_program_intelligence_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "university_program_intelligence_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "university_program_intelligence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_program_intelligence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_program_intelligence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_program_intelligence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_program_intelligence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_program_intelligence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_program_intelligence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_program_intelligence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "university_program_intelligence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_program_intelligence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_program_intelligence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_program_intelligence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      university_source_evidence: {
        Row: {
          batch_id: string | null
          confidence: number | null
          created_at: string
          data_extracted: Json | null
          extractor: string | null
          field: string
          id: string
          source_urls: string[]
          text_snippet: string | null
          university_id: string
          updated_at: string
        }
        Insert: {
          batch_id?: string | null
          confidence?: number | null
          created_at?: string
          data_extracted?: Json | null
          extractor?: string | null
          field: string
          id?: string
          source_urls?: string[]
          text_snippet?: string | null
          university_id: string
          updated_at?: string
        }
        Update: {
          batch_id?: string | null
          confidence?: number | null
          created_at?: string
          data_extracted?: Json | null
          extractor?: string | null
          field?: string
          id?: string
          source_urls?: string[]
          text_snippet?: string | null
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_source_evidence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_source_evidence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_source_evidence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_source_evidence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_source_evidence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_source_evidence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_source_evidence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_source_evidence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "university_source_evidence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_source_evidence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_source_evidence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "university_source_evidence_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      user_presence: {
        Row: {
          is_online: boolean
          last_seen_at: string
          user_id: string
        }
        Insert: {
          is_online?: boolean
          last_seen_at?: string
          user_id: string
        }
        Update: {
          is_online?: boolean
          last_seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_shortlists: {
        Row: {
          created_at: string | null
          program_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          program_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          program_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_shortlists_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "user_shortlists_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_shortlists_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "user_shortlists_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "user_shortlists_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "user_shortlists_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "user_shortlists_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "user_shortlists_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "user_shortlists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      web_chat_sessions: {
        Row: {
          created_at: string | null
          customer_id: string | null
          external_conversation_id: string
          id: string
          last_message_at: string | null
          locale: string | null
          normalized_phone: string | null
          otp_code: string | null
          otp_expires_at: string | null
          phone: string | null
          stage: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          external_conversation_id: string
          id?: string
          last_message_at?: string | null
          locale?: string | null
          normalized_phone?: string | null
          otp_code?: string | null
          otp_expires_at?: string | null
          phone?: string | null
          stage?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          external_conversation_id?: string
          id?: string
          last_message_at?: string | null
          locale?: string | null
          normalized_phone?: string | null
          otp_code?: string | null
          otp_expires_at?: string | null
          phone?: string | null
          stage?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      website_enrichment_jobs: {
        Row: {
          batch_size: number
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_summary: string | null
          failed_rows: number
          filter_criteria: Json
          id: string
          last_activity_at: string | null
          matched_rows: number
          paused_at: string | null
          processed_rows: number
          provider_config: Json
          review_rows: number
          skipped_rows: number
          started_at: string | null
          status: string
          tick_lease_expires_at: string | null
          tick_lease_owner: string | null
          total_rows: number
          trace_id: string | null
        }
        Insert: {
          batch_size?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_summary?: string | null
          failed_rows?: number
          filter_criteria?: Json
          id?: string
          last_activity_at?: string | null
          matched_rows?: number
          paused_at?: string | null
          processed_rows?: number
          provider_config?: Json
          review_rows?: number
          skipped_rows?: number
          started_at?: string | null
          status?: string
          tick_lease_expires_at?: string | null
          tick_lease_owner?: string | null
          total_rows?: number
          trace_id?: string | null
        }
        Update: {
          batch_size?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_summary?: string | null
          failed_rows?: number
          filter_criteria?: Json
          id?: string
          last_activity_at?: string | null
          matched_rows?: number
          paused_at?: string | null
          processed_rows?: number
          provider_config?: Json
          review_rows?: number
          skipped_rows?: number
          started_at?: string | null
          status?: string
          tick_lease_expires_at?: string | null
          tick_lease_owner?: string | null
          total_rows?: number
          trace_id?: string | null
        }
        Relationships: []
      }
      website_enrichment_rows: {
        Row: {
          attempt_count: number
          city: string | null
          confidence_score: number | null
          country_code: string | null
          created_at: string
          enriched_at: string | null
          enrichment_status: string
          id: string
          job_id: string
          last_error: string | null
          last_stage: string | null
          lease_owner: string | null
          locked_at: string | null
          match_reason: string | null
          match_source: string | null
          matched_city: string | null
          matched_country: string | null
          matched_entity_name: string | null
          needs_manual_review: boolean
          official_website_domain: string | null
          official_website_url: string | null
          processed_at: string | null
          provider_candidates: Json | null
          provider_homepage_url_raw: string | null
          raw_provider_response: Json | null
          review_action: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          university_id: string
          university_name: string | null
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          city?: string | null
          confidence_score?: number | null
          country_code?: string | null
          created_at?: string
          enriched_at?: string | null
          enrichment_status?: string
          id?: string
          job_id: string
          last_error?: string | null
          last_stage?: string | null
          lease_owner?: string | null
          locked_at?: string | null
          match_reason?: string | null
          match_source?: string | null
          matched_city?: string | null
          matched_country?: string | null
          matched_entity_name?: string | null
          needs_manual_review?: boolean
          official_website_domain?: string | null
          official_website_url?: string | null
          processed_at?: string | null
          provider_candidates?: Json | null
          provider_homepage_url_raw?: string | null
          raw_provider_response?: Json | null
          review_action?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          university_id: string
          university_name?: string | null
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          city?: string | null
          confidence_score?: number | null
          country_code?: string | null
          created_at?: string
          enriched_at?: string | null
          enrichment_status?: string
          id?: string
          job_id?: string
          last_error?: string | null
          last_stage?: string | null
          lease_owner?: string | null
          locked_at?: string | null
          match_reason?: string | null
          match_source?: string | null
          matched_city?: string | null
          matched_country?: string | null
          matched_entity_name?: string | null
          needs_manual_review?: boolean
          official_website_domain?: string | null
          official_website_url?: string | null
          processed_at?: string | null
          provider_candidates?: Json | null
          provider_homepage_url_raw?: string | null
          raw_provider_response?: Json | null
          review_action?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          university_id?: string
          university_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_enrichment_rows_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "website_enrichment_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_enrichment_rows_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "website_enrichment_rows_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "website_enrichment_rows_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_enrichment_rows_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "website_enrichment_rows_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "website_enrichment_rows_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "website_enrichment_rows_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "website_enrichment_rows_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "website_enrichment_rows_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_enrichment_rows_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "website_enrichment_rows_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "website_enrichment_rows_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      door2_review_current_v1: {
        Row: {
          admissions_source_url: string | null
          application_fee: number | null
          approval_tier: string | null
          batch_id: string | null
          confidence_score: number | null
          content_hash: string | null
          country_code: string | null
          created_at: string | null
          currency: string | null
          currency_code: string | null
          degree_level: string | null
          duration_months: number | null
          extracted_json: Json | null
          extractor_version: string | null
          fee_as_of_year: string | null
          fee_captured_at: string | null
          fee_content_hash: string | null
          field_evidence_map: Json | null
          final_confidence: number | null
          fingerprint: string | null
          flags: string[] | null
          gpt5_reasoning: string | null
          id: number | null
          intake_months: string[] | null
          language: string | null
          last_extracted_at: string | null
          last_verified_at: string | null
          missing_fields: string[] | null
          program_key: string | null
          program_slug: string | null
          publish_trace_id: string | null
          published_at: string | null
          published_by: string | null
          published_program_id: string | null
          raw_page_id: number | null
          rejection_reasons: Json | null
          requirements: string[] | null
          review_status: string | null
          rn: number | null
          schema_version: string | null
          source_program_url: string | null
          source_url: string | null
          status: string | null
          title: string | null
          title_en: string | null
          tuition_fee: number | null
          tuition_source_url: string | null
          university_id: string | null
          university_name: string | null
          verification_result: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "program_draft_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "crawl_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "program_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "program_draft_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rates_latest: {
        Row: {
          as_of_date: string | null
          created_at: string | null
          currency_code: string | null
          rate_to_usd: number | null
          source: string | null
        }
        Relationships: []
      }
      mv_university_catalog_fts: {
        Row: {
          program_id: string | null
          tsv: unknown
          university_id: string | null
        }
        Relationships: []
      }
      program_quality_v3: {
        Row: {
          degree_id_coverage: number | null
          description_coverage: number | null
          discipline_id_coverage: number | null
          duration_months_coverage: number | null
          gpa_coverage: number | null
          ielts_coverage: number | null
          ready_to_publish_count: number | null
          scholarship_type_coverage: number | null
          toefl_coverage: number | null
          total_programs: number | null
          tuition_basis_coverage: number | null
          tuition_scope_coverage: number | null
          tuition_usd_min_coverage: number | null
          university_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      programs_view: {
        Row: {
          accepted_certificates: string[] | null
          annual_fees: number | null
          city: string | null
          country_slug: string | null
          degree_slug: string | null
          description: string | null
          languages: string[] | null
          monthly_living: number | null
          next_intake: string | null
          program_id: string | null
          ranking: number | null
          title: string | null
          university_id: string | null
          university_name: string | null
        }
        Relationships: []
      }
      source_health_v1: {
        Row: {
          avg_content_len: number | null
          blocked_rate_pct: number | null
          checksum_available_pct: number | null
          day_bucket: string | null
          status_2xx: number | null
          status_4xx: number | null
          status_5xx: number | null
          total_pages: number | null
        }
        Relationships: []
      }
      uniranks_job_health_v1: {
        Row: {
          created_at: string | null
          job_id: string | null
          programs_discovered: number | null
          programs_rejected: number | null
          programs_saved: number | null
          programs_valid: number | null
          top_reasons: Json | null
        }
        Insert: {
          created_at?: string | null
          job_id?: string | null
          programs_discovered?: never
          programs_rejected?: never
          programs_saved?: never
          programs_valid?: never
          top_reasons?: never
        }
        Update: {
          created_at?: string | null
          job_id?: string | null
          programs_discovered?: never
          programs_rejected?: never
          programs_saved?: never
          programs_valid?: never
          top_reasons?: never
        }
        Relationships: []
      }
      vw_admissions_public: {
        Row: {
          audience: string | null
          confidence_score: number | null
          consensus_min_gpa: number | null
          consensus_min_ielts: number | null
          consensus_min_toefl: number | null
          consensus_other_requirements: Json | null
          degree_level: string | null
          last_updated_at: string | null
          program_id: string | null
          university_id: string | null
        }
        Insert: {
          audience?: string | null
          confidence_score?: number | null
          consensus_min_gpa?: number | null
          consensus_min_ielts?: number | null
          consensus_min_toefl?: number | null
          consensus_other_requirements?: Json | null
          degree_level?: string | null
          last_updated_at?: string | null
          program_id?: string | null
          university_id?: string | null
        }
        Update: {
          audience?: string | null
          confidence_score?: number | null
          consensus_min_gpa?: number | null
          consensus_min_ielts?: number | null
          consensus_min_toefl?: number | null
          consensus_other_requirements?: Json | null
          degree_level?: string | null
          last_updated_at?: string | null
          program_id?: string | null
          university_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admissions_consensus_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "admissions_consensus_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_consensus_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "admissions_consensus_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "admissions_consensus_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "admissions_consensus_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "admissions_consensus_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "admissions_consensus_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "admissions_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "admissions_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "admissions_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "admissions_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "admissions_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "admissions_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "admissions_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "admissions_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admissions_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "admissions_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "admissions_consensus_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_entity_enrichment_published: {
        Row: {
          confidence: number | null
          display_text: string | null
          entity_id: string | null
          entity_type: Database["public"]["Enums"]["orx_entity_type"] | null
          fact_key: string | null
          fact_type: string | null
          fact_value: Json | null
          first_seen_at: string | null
          id: string | null
          last_verified_at: string | null
          source_domain: string | null
          source_type: string | null
          source_url: string | null
        }
        Insert: {
          confidence?: number | null
          display_text?: string | null
          entity_id?: string | null
          entity_type?: Database["public"]["Enums"]["orx_entity_type"] | null
          fact_key?: string | null
          fact_type?: string | null
          fact_value?: Json | null
          first_seen_at?: string | null
          id?: string | null
          last_verified_at?: string | null
          source_domain?: string | null
          source_type?: string | null
          source_url?: string | null
        }
        Update: {
          confidence?: number | null
          display_text?: string | null
          entity_id?: string | null
          entity_type?: Database["public"]["Enums"]["orx_entity_type"] | null
          fact_key?: string | null
          fact_type?: string | null
          fact_value?: Json | null
          first_seen_at?: string | null
          id?: string | null
          last_verified_at?: string | null
          source_domain?: string | null
          source_type?: string | null
          source_url?: string | null
        }
        Relationships: []
      }
      vw_events_search: {
        Row: {
          city: string | null
          country_id: string | null
          country_name: string | null
          country_slug: string | null
          end_at: string | null
          event_type: string | null
          id: string | null
          is_online: boolean | null
          organizer: string | null
          start_at: string | null
          title: string | null
          url: string | null
          venue_name: string | null
        }
        Relationships: []
      }
      vw_harvest_job_summary: {
        Row: {
          audience: string | null
          country_code: string | null
          created_at: string | null
          finished_at: string | null
          job_id: number | null
          job_status: string | null
          kind: string | null
          runs_count: number | null
          runs_done: number | null
          runs_error: number | null
          started_at: string | null
          total_changed: number | null
          total_errors: number | null
          total_processed: number | null
        }
        Relationships: []
      }
      vw_orx_dimension_facts_internal: {
        Row: {
          boundary_type: Database["public"]["Enums"]["orx_fact_boundary"] | null
          comparability_score: number | null
          confidence: number | null
          coverage_score: number | null
          created_at: string | null
          dimension_domain:
            | Database["public"]["Enums"]["orx_dimension_domain"]
            | null
          display_text: string | null
          entity_id: string | null
          entity_type: string | null
          fact_family: string | null
          fact_key: string | null
          fact_value: Json | null
          first_seen_at: string | null
          freshness_date: string | null
          id: string | null
          last_seen_at: string | null
          last_verified_at: string | null
          methodology_version: string | null
          regional_bias_flag: boolean | null
          source_domain: string | null
          source_family: string | null
          source_type: string | null
          source_url: string | null
          sparsity_flag: boolean | null
          status:
            | Database["public"]["Enums"]["orx_dimension_fact_status"]
            | null
          updated_at: string | null
        }
        Insert: {
          boundary_type?:
            | Database["public"]["Enums"]["orx_fact_boundary"]
            | null
          comparability_score?: number | null
          confidence?: number | null
          coverage_score?: number | null
          created_at?: string | null
          dimension_domain?:
            | Database["public"]["Enums"]["orx_dimension_domain"]
            | null
          display_text?: string | null
          entity_id?: string | null
          entity_type?: string | null
          fact_family?: string | null
          fact_key?: string | null
          fact_value?: Json | null
          first_seen_at?: string | null
          freshness_date?: string | null
          id?: string | null
          last_seen_at?: string | null
          last_verified_at?: string | null
          methodology_version?: string | null
          regional_bias_flag?: boolean | null
          source_domain?: string | null
          source_family?: string | null
          source_type?: string | null
          source_url?: string | null
          sparsity_flag?: boolean | null
          status?:
            | Database["public"]["Enums"]["orx_dimension_fact_status"]
            | null
          updated_at?: string | null
        }
        Update: {
          boundary_type?:
            | Database["public"]["Enums"]["orx_fact_boundary"]
            | null
          comparability_score?: number | null
          confidence?: number | null
          coverage_score?: number | null
          created_at?: string | null
          dimension_domain?:
            | Database["public"]["Enums"]["orx_dimension_domain"]
            | null
          display_text?: string | null
          entity_id?: string | null
          entity_type?: string | null
          fact_family?: string | null
          fact_key?: string | null
          fact_value?: Json | null
          first_seen_at?: string | null
          freshness_date?: string | null
          id?: string | null
          last_seen_at?: string | null
          last_verified_at?: string | null
          methodology_version?: string | null
          regional_bias_flag?: boolean | null
          source_domain?: string | null
          source_family?: string | null
          source_type?: string | null
          source_url?: string | null
          sparsity_flag?: boolean | null
          status?:
            | Database["public"]["Enums"]["orx_dimension_fact_status"]
            | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vw_orx_dimension_facts_published: {
        Row: {
          boundary_type: Database["public"]["Enums"]["orx_fact_boundary"] | null
          comparability_score: number | null
          confidence: number | null
          coverage_score: number | null
          created_at: string | null
          dimension_domain:
            | Database["public"]["Enums"]["orx_dimension_domain"]
            | null
          display_text: string | null
          entity_id: string | null
          entity_type: string | null
          fact_family: string | null
          fact_key: string | null
          fact_value: Json | null
          first_seen_at: string | null
          freshness_date: string | null
          id: string | null
          last_seen_at: string | null
          last_verified_at: string | null
          methodology_version: string | null
          regional_bias_flag: boolean | null
          source_domain: string | null
          source_family: string | null
          source_type: string | null
          source_url: string | null
          sparsity_flag: boolean | null
          status:
            | Database["public"]["Enums"]["orx_dimension_fact_status"]
            | null
          updated_at: string | null
        }
        Insert: {
          boundary_type?:
            | Database["public"]["Enums"]["orx_fact_boundary"]
            | null
          comparability_score?: number | null
          confidence?: number | null
          coverage_score?: number | null
          created_at?: string | null
          dimension_domain?:
            | Database["public"]["Enums"]["orx_dimension_domain"]
            | null
          display_text?: string | null
          entity_id?: string | null
          entity_type?: string | null
          fact_family?: string | null
          fact_key?: string | null
          fact_value?: Json | null
          first_seen_at?: string | null
          freshness_date?: string | null
          id?: string | null
          last_seen_at?: string | null
          last_verified_at?: string | null
          methodology_version?: string | null
          regional_bias_flag?: boolean | null
          source_domain?: string | null
          source_family?: string | null
          source_type?: string | null
          source_url?: string | null
          sparsity_flag?: boolean | null
          status?:
            | Database["public"]["Enums"]["orx_dimension_fact_status"]
            | null
          updated_at?: string | null
        }
        Update: {
          boundary_type?:
            | Database["public"]["Enums"]["orx_fact_boundary"]
            | null
          comparability_score?: number | null
          confidence?: number | null
          coverage_score?: number | null
          created_at?: string | null
          dimension_domain?:
            | Database["public"]["Enums"]["orx_dimension_domain"]
            | null
          display_text?: string | null
          entity_id?: string | null
          entity_type?: string | null
          fact_family?: string | null
          fact_key?: string | null
          fact_value?: Json | null
          first_seen_at?: string | null
          freshness_date?: string | null
          id?: string | null
          last_seen_at?: string | null
          last_verified_at?: string | null
          methodology_version?: string | null
          regional_bias_flag?: boolean | null
          source_domain?: string | null
          source_family?: string | null
          source_type?: string | null
          source_url?: string | null
          sparsity_flag?: boolean | null
          status?:
            | Database["public"]["Enums"]["orx_dimension_fact_status"]
            | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vw_orx_dimension_readiness: {
        Row: {
          approved_facts: number | null
          avg_comparability: number | null
          avg_confidence: number | null
          avg_coverage: number | null
          dimension_domain:
            | Database["public"]["Enums"]["orx_dimension_domain"]
            | null
          fact_families_covered: number | null
          pending_facts: number | null
          published_facts: number | null
          regional_bias_pct: number | null
          source_diversity: number | null
          sparsity_pct: number | null
          total_facts: number | null
          unique_entities: number | null
        }
        Relationships: []
      }
      vw_orx_entity_coverage: {
        Row: {
          approved_facts: number | null
          avg_comparability: number | null
          avg_confidence: number | null
          avg_coverage: number | null
          candidate_facts: number | null
          dimension_domain:
            | Database["public"]["Enums"]["orx_dimension_domain"]
            | null
          entity_id: string | null
          entity_type: string | null
          fact_family_coverage: number | null
          has_regional_bias: boolean | null
          has_sparsity: boolean | null
          published_facts: number | null
          source_diversity: number | null
          total_facts: number | null
        }
        Relationships: []
      }
      vw_orx_facts_approved_unpublished: {
        Row: {
          boundary_type: Database["public"]["Enums"]["orx_fact_boundary"] | null
          comparability_score: number | null
          confidence: number | null
          coverage_score: number | null
          created_at: string | null
          dimension_domain:
            | Database["public"]["Enums"]["orx_dimension_domain"]
            | null
          display_text: string | null
          entity_id: string | null
          entity_type: string | null
          fact_family: string | null
          fact_key: string | null
          fact_value: Json | null
          first_seen_at: string | null
          freshness_date: string | null
          id: string | null
          last_seen_at: string | null
          last_verified_at: string | null
          methodology_version: string | null
          regional_bias_flag: boolean | null
          source_domain: string | null
          source_family: string | null
          source_type: string | null
          source_url: string | null
          sparsity_flag: boolean | null
          status:
            | Database["public"]["Enums"]["orx_dimension_fact_status"]
            | null
          updated_at: string | null
        }
        Insert: {
          boundary_type?:
            | Database["public"]["Enums"]["orx_fact_boundary"]
            | null
          comparability_score?: number | null
          confidence?: number | null
          coverage_score?: number | null
          created_at?: string | null
          dimension_domain?:
            | Database["public"]["Enums"]["orx_dimension_domain"]
            | null
          display_text?: string | null
          entity_id?: string | null
          entity_type?: string | null
          fact_family?: string | null
          fact_key?: string | null
          fact_value?: Json | null
          first_seen_at?: string | null
          freshness_date?: string | null
          id?: string | null
          last_seen_at?: string | null
          last_verified_at?: string | null
          methodology_version?: string | null
          regional_bias_flag?: boolean | null
          source_domain?: string | null
          source_family?: string | null
          source_type?: string | null
          source_url?: string | null
          sparsity_flag?: boolean | null
          status?:
            | Database["public"]["Enums"]["orx_dimension_fact_status"]
            | null
          updated_at?: string | null
        }
        Update: {
          boundary_type?:
            | Database["public"]["Enums"]["orx_fact_boundary"]
            | null
          comparability_score?: number | null
          confidence?: number | null
          coverage_score?: number | null
          created_at?: string | null
          dimension_domain?:
            | Database["public"]["Enums"]["orx_dimension_domain"]
            | null
          display_text?: string | null
          entity_id?: string | null
          entity_type?: string | null
          fact_family?: string | null
          fact_key?: string | null
          fact_value?: Json | null
          first_seen_at?: string | null
          freshness_date?: string | null
          id?: string | null
          last_seen_at?: string | null
          last_verified_at?: string | null
          methodology_version?: string | null
          regional_bias_flag?: boolean | null
          source_domain?: string | null
          source_family?: string | null
          source_type?: string | null
          source_url?: string | null
          sparsity_flag?: boolean | null
          status?:
            | Database["public"]["Enums"]["orx_dimension_fact_status"]
            | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vw_orx_facts_audit_summary: {
        Row: {
          avg_comparability: number | null
          avg_confidence: number | null
          avg_coverage: number | null
          boundary_type: Database["public"]["Enums"]["orx_fact_boundary"] | null
          dimension_domain:
            | Database["public"]["Enums"]["orx_dimension_domain"]
            | null
          fact_count: number | null
          fact_family: string | null
          newest_freshness: string | null
          oldest_freshness: string | null
          regional_bias_flagged: number | null
          source_family: string | null
          sparsity_flagged: number | null
          status:
            | Database["public"]["Enums"]["orx_dimension_fact_status"]
            | null
        }
        Relationships: []
      }
      vw_orx_facts_pending_review: {
        Row: {
          boundary_type: Database["public"]["Enums"]["orx_fact_boundary"] | null
          comparability_score: number | null
          confidence: number | null
          coverage_score: number | null
          created_at: string | null
          dimension_domain:
            | Database["public"]["Enums"]["orx_dimension_domain"]
            | null
          display_text: string | null
          entity_id: string | null
          entity_type: string | null
          fact_family: string | null
          fact_key: string | null
          fact_value: Json | null
          first_seen_at: string | null
          freshness_date: string | null
          id: string | null
          last_seen_at: string | null
          last_verified_at: string | null
          methodology_version: string | null
          regional_bias_flag: boolean | null
          source_domain: string | null
          source_family: string | null
          source_type: string | null
          source_url: string | null
          sparsity_flag: boolean | null
          status:
            | Database["public"]["Enums"]["orx_dimension_fact_status"]
            | null
          updated_at: string | null
        }
        Insert: {
          boundary_type?:
            | Database["public"]["Enums"]["orx_fact_boundary"]
            | null
          comparability_score?: number | null
          confidence?: number | null
          coverage_score?: number | null
          created_at?: string | null
          dimension_domain?:
            | Database["public"]["Enums"]["orx_dimension_domain"]
            | null
          display_text?: string | null
          entity_id?: string | null
          entity_type?: string | null
          fact_family?: string | null
          fact_key?: string | null
          fact_value?: Json | null
          first_seen_at?: string | null
          freshness_date?: string | null
          id?: string | null
          last_seen_at?: string | null
          last_verified_at?: string | null
          methodology_version?: string | null
          regional_bias_flag?: boolean | null
          source_domain?: string | null
          source_family?: string | null
          source_type?: string | null
          source_url?: string | null
          sparsity_flag?: boolean | null
          status?:
            | Database["public"]["Enums"]["orx_dimension_fact_status"]
            | null
          updated_at?: string | null
        }
        Update: {
          boundary_type?:
            | Database["public"]["Enums"]["orx_fact_boundary"]
            | null
          comparability_score?: number | null
          confidence?: number | null
          coverage_score?: number | null
          created_at?: string | null
          dimension_domain?:
            | Database["public"]["Enums"]["orx_dimension_domain"]
            | null
          display_text?: string | null
          entity_id?: string | null
          entity_type?: string | null
          fact_family?: string | null
          fact_key?: string | null
          fact_value?: Json | null
          first_seen_at?: string | null
          freshness_date?: string | null
          id?: string | null
          last_seen_at?: string | null
          last_verified_at?: string | null
          methodology_version?: string | null
          regional_bias_flag?: boolean | null
          source_domain?: string | null
          source_family?: string | null
          source_type?: string | null
          source_url?: string | null
          sparsity_flag?: boolean | null
          status?:
            | Database["public"]["Enums"]["orx_dimension_fact_status"]
            | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vw_orx_facts_published: {
        Row: {
          boundary_type: Database["public"]["Enums"]["orx_fact_boundary"] | null
          comparability_score: number | null
          confidence: number | null
          coverage_score: number | null
          created_at: string | null
          dimension_domain:
            | Database["public"]["Enums"]["orx_dimension_domain"]
            | null
          display_text: string | null
          entity_id: string | null
          entity_type: string | null
          fact_family: string | null
          fact_key: string | null
          fact_value: Json | null
          first_seen_at: string | null
          freshness_date: string | null
          id: string | null
          last_seen_at: string | null
          last_verified_at: string | null
          methodology_version: string | null
          regional_bias_flag: boolean | null
          source_domain: string | null
          source_family: string | null
          source_type: string | null
          source_url: string | null
          sparsity_flag: boolean | null
          status:
            | Database["public"]["Enums"]["orx_dimension_fact_status"]
            | null
          updated_at: string | null
        }
        Insert: {
          boundary_type?:
            | Database["public"]["Enums"]["orx_fact_boundary"]
            | null
          comparability_score?: number | null
          confidence?: number | null
          coverage_score?: number | null
          created_at?: string | null
          dimension_domain?:
            | Database["public"]["Enums"]["orx_dimension_domain"]
            | null
          display_text?: string | null
          entity_id?: string | null
          entity_type?: string | null
          fact_family?: string | null
          fact_key?: string | null
          fact_value?: Json | null
          first_seen_at?: string | null
          freshness_date?: string | null
          id?: string | null
          last_seen_at?: string | null
          last_verified_at?: string | null
          methodology_version?: string | null
          regional_bias_flag?: boolean | null
          source_domain?: string | null
          source_family?: string | null
          source_type?: string | null
          source_url?: string | null
          sparsity_flag?: boolean | null
          status?:
            | Database["public"]["Enums"]["orx_dimension_fact_status"]
            | null
          updated_at?: string | null
        }
        Update: {
          boundary_type?:
            | Database["public"]["Enums"]["orx_fact_boundary"]
            | null
          comparability_score?: number | null
          confidence?: number | null
          coverage_score?: number | null
          created_at?: string | null
          dimension_domain?:
            | Database["public"]["Enums"]["orx_dimension_domain"]
            | null
          display_text?: string | null
          entity_id?: string | null
          entity_type?: string | null
          fact_family?: string | null
          fact_key?: string | null
          fact_value?: Json | null
          first_seen_at?: string | null
          freshness_date?: string | null
          id?: string | null
          last_seen_at?: string | null
          last_verified_at?: string | null
          methodology_version?: string | null
          regional_bias_flag?: boolean | null
          source_domain?: string | null
          source_family?: string | null
          source_type?: string | null
          source_url?: string | null
          sparsity_flag?: boolean | null
          status?:
            | Database["public"]["Enums"]["orx_dimension_fact_status"]
            | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vw_orx_facts_rejected: {
        Row: {
          boundary_type: Database["public"]["Enums"]["orx_fact_boundary"] | null
          comparability_score: number | null
          confidence: number | null
          coverage_score: number | null
          created_at: string | null
          dimension_domain:
            | Database["public"]["Enums"]["orx_dimension_domain"]
            | null
          display_text: string | null
          entity_id: string | null
          entity_type: string | null
          fact_family: string | null
          fact_key: string | null
          fact_value: Json | null
          first_seen_at: string | null
          freshness_date: string | null
          id: string | null
          last_seen_at: string | null
          last_verified_at: string | null
          methodology_version: string | null
          regional_bias_flag: boolean | null
          source_domain: string | null
          source_family: string | null
          source_type: string | null
          source_url: string | null
          sparsity_flag: boolean | null
          status:
            | Database["public"]["Enums"]["orx_dimension_fact_status"]
            | null
          updated_at: string | null
        }
        Insert: {
          boundary_type?:
            | Database["public"]["Enums"]["orx_fact_boundary"]
            | null
          comparability_score?: number | null
          confidence?: number | null
          coverage_score?: number | null
          created_at?: string | null
          dimension_domain?:
            | Database["public"]["Enums"]["orx_dimension_domain"]
            | null
          display_text?: string | null
          entity_id?: string | null
          entity_type?: string | null
          fact_family?: string | null
          fact_key?: string | null
          fact_value?: Json | null
          first_seen_at?: string | null
          freshness_date?: string | null
          id?: string | null
          last_seen_at?: string | null
          last_verified_at?: string | null
          methodology_version?: string | null
          regional_bias_flag?: boolean | null
          source_domain?: string | null
          source_family?: string | null
          source_type?: string | null
          source_url?: string | null
          sparsity_flag?: boolean | null
          status?:
            | Database["public"]["Enums"]["orx_dimension_fact_status"]
            | null
          updated_at?: string | null
        }
        Update: {
          boundary_type?:
            | Database["public"]["Enums"]["orx_fact_boundary"]
            | null
          comparability_score?: number | null
          confidence?: number | null
          coverage_score?: number | null
          created_at?: string | null
          dimension_domain?:
            | Database["public"]["Enums"]["orx_dimension_domain"]
            | null
          display_text?: string | null
          entity_id?: string | null
          entity_type?: string | null
          fact_family?: string | null
          fact_key?: string | null
          fact_value?: Json | null
          first_seen_at?: string | null
          freshness_date?: string | null
          id?: string | null
          last_seen_at?: string | null
          last_verified_at?: string | null
          methodology_version?: string | null
          regional_bias_flag?: boolean | null
          source_domain?: string | null
          source_family?: string | null
          source_type?: string | null
          source_url?: string | null
          sparsity_flag?: boolean | null
          status?:
            | Database["public"]["Enums"]["orx_dimension_fact_status"]
            | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vw_orx_facts_stale: {
        Row: {
          boundary_type: Database["public"]["Enums"]["orx_fact_boundary"] | null
          comparability_score: number | null
          confidence: number | null
          coverage_score: number | null
          created_at: string | null
          dimension_domain:
            | Database["public"]["Enums"]["orx_dimension_domain"]
            | null
          display_text: string | null
          entity_id: string | null
          entity_type: string | null
          fact_family: string | null
          fact_key: string | null
          fact_value: Json | null
          first_seen_at: string | null
          freshness_date: string | null
          id: string | null
          last_seen_at: string | null
          last_verified_at: string | null
          methodology_version: string | null
          regional_bias_flag: boolean | null
          source_domain: string | null
          source_family: string | null
          source_type: string | null
          source_url: string | null
          sparsity_flag: boolean | null
          status:
            | Database["public"]["Enums"]["orx_dimension_fact_status"]
            | null
          updated_at: string | null
        }
        Insert: {
          boundary_type?:
            | Database["public"]["Enums"]["orx_fact_boundary"]
            | null
          comparability_score?: number | null
          confidence?: number | null
          coverage_score?: number | null
          created_at?: string | null
          dimension_domain?:
            | Database["public"]["Enums"]["orx_dimension_domain"]
            | null
          display_text?: string | null
          entity_id?: string | null
          entity_type?: string | null
          fact_family?: string | null
          fact_key?: string | null
          fact_value?: Json | null
          first_seen_at?: string | null
          freshness_date?: string | null
          id?: string | null
          last_seen_at?: string | null
          last_verified_at?: string | null
          methodology_version?: string | null
          regional_bias_flag?: boolean | null
          source_domain?: string | null
          source_family?: string | null
          source_type?: string | null
          source_url?: string | null
          sparsity_flag?: boolean | null
          status?:
            | Database["public"]["Enums"]["orx_dimension_fact_status"]
            | null
          updated_at?: string | null
        }
        Update: {
          boundary_type?:
            | Database["public"]["Enums"]["orx_fact_boundary"]
            | null
          comparability_score?: number | null
          confidence?: number | null
          coverage_score?: number | null
          created_at?: string | null
          dimension_domain?:
            | Database["public"]["Enums"]["orx_dimension_domain"]
            | null
          display_text?: string | null
          entity_id?: string | null
          entity_type?: string | null
          fact_family?: string | null
          fact_key?: string | null
          fact_value?: Json | null
          first_seen_at?: string | null
          freshness_date?: string | null
          id?: string | null
          last_seen_at?: string | null
          last_verified_at?: string | null
          methodology_version?: string | null
          regional_bias_flag?: boolean | null
          source_domain?: string | null
          source_family?: string | null
          source_type?: string | null
          source_url?: string | null
          sparsity_flag?: boolean | null
          status?:
            | Database["public"]["Enums"]["orx_dimension_fact_status"]
            | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vw_portal_applications_v1: {
        Row: {
          auth_user_id: string | null
          country_code: string | null
          created_at: string | null
          currency: string | null
          evidence_storage_bucket: string | null
          evidence_storage_path: string | null
          id: string | null
          payment_id: string | null
          payment_status: string | null
          program_id: string | null
          program_name: string | null
          receipt_no: string | null
          rejected_at: string | null
          rejection_reason: string | null
          services_json: Json | null
          status: string | null
          total_amount: number | null
          university_name: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      vw_program_details: {
        Row: {
          accepted_certificates: string[] | null
          admission_notes_text: string | null
          application_deadline: string | null
          apply_url: string | null
          cefr_level: string | null
          city: string | null
          country_id: string | null
          country_name: string | null
          country_name_ar: string | null
          country_name_en: string | null
          country_slug: string | null
          currency_code: string | null
          degree_id: string | null
          degree_name: string | null
          degree_name_ar: string | null
          degree_name_en: string | null
          degree_slug: string | null
          description: string | null
          duolingo_min: number | null
          duration_months: number | null
          ielts_required: number | null
          intake_label: string | null
          intake_months: string[] | null
          languages: string[] | null
          logo_url: string | null
          next_intake: string | null
          next_intake_date: string | null
          program_currency: string | null
          program_id: string | null
          program_name: string | null
          program_name_ar: string | null
          program_name_en: string | null
          pte_min: number | null
          ranking: number | null
          requirements_text: string | null
          tuition_basis: string | null
          tuition_usd_max: number | null
          tuition_usd_min: number | null
          university_id: string | null
          university_monthly_living: number | null
          university_name: string | null
          university_name_ar: string | null
          university_name_en: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programs_degree_id_fkey"
            columns: ["degree_id"]
            isOneToOne: false
            referencedRelation: "degrees"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_program_search: {
        Row: {
          accepted_certificates: string[] | null
          admission_notes_text: string | null
          application_deadline: string | null
          apply_url: string | null
          cefr_level: string | null
          city: string | null
          country_id: string | null
          country_name: string | null
          country_slug: string | null
          currency_code: string | null
          degree_id: string | null
          degree_name: string | null
          degree_slug: string | null
          description: string | null
          duolingo_min: number | null
          duration_months: number | null
          ielts_required: number | null
          intake_label: string | null
          intake_months: string[] | null
          languages: string[] | null
          logo_url: string | null
          main_image_url: string | null
          next_intake: string | null
          next_intake_date: string | null
          program_currency: string | null
          program_id: string | null
          program_name: string | null
          pte_min: number | null
          ranking: number | null
          requirements_text: string | null
          tuition_basis: string | null
          tuition_usd_max: number | null
          tuition_usd_min: number | null
          university_id: string | null
          university_monthly_living: number | null
          university_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programs_degree_id_fkey"
            columns: ["degree_id"]
            isOneToOne: false
            referencedRelation: "degrees"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_program_search_api: {
        Row: {
          city: string | null
          country_code: string | null
          country_id: string | null
          country_name_ar: string | null
          country_name_en: string | null
          currency_code: string | null
          degree_name: string | null
          degree_slug: string | null
          description: string | null
          discipline_aliases_ar: string[] | null
          discipline_aliases_en: string[] | null
          discipline_name_ar: string | null
          discipline_name_en: string | null
          discipline_slug: string | null
          dorm_currency_code: string | null
          dorm_price_monthly_local: number | null
          dorm_price_monthly_usd: number | null
          duration_months: number | null
          has_dorm: boolean | null
          is_active: boolean | null
          language: string | null
          languages: string[] | null
          monthly_living: number | null
          portal_url: string | null
          program_id: string | null
          program_name_ar: string | null
          program_name_en: string | null
          publish_status: string | null
          ranking: number | null
          tuition_is_free: boolean | null
          tuition_local_amount: number | null
          tuition_usd_max: number | null
          tuition_usd_min: number | null
          university_id: string | null
          university_logo: string | null
          university_monthly_living: number | null
          university_name_ar: string | null
          university_name_en: string | null
        }
        Relationships: []
      }
      vw_program_search_api_v3_final: {
        Row: {
          academic_reputation_score: number | null
          apply_url: string | null
          cefr_level: string | null
          city: string | null
          country_code: string | null
          country_name_ar: string | null
          country_name_en: string | null
          currency_code: string | null
          deadline_date: string | null
          degree_name: string | null
          degree_slug: string | null
          discipline_name_ar: string | null
          discipline_name_en: string | null
          discipline_slug: string | null
          display_name_i18n: Json | null
          do_not_offer: boolean | null
          dorm_currency_code: string | null
          dorm_price_monthly_local: number | null
          dorm_price_monthly_usd: number | null
          duolingo_min: number | null
          duration_months: number | null
          employability_score: number | null
          entrance_exam_required: boolean | null
          entrance_exam_types: string[] | null
          foundation_required: boolean | null
          has_dorm: boolean | null
          ielts_required: number | null
          instruction_languages: string[] | null
          intake_months: string[] | null
          is_active: boolean | null
          monthly_living_usd: number | null
          national_rank: number | null
          overall_score: number | null
          partner_preferred: boolean | null
          partner_star: boolean | null
          partner_tier: string | null
          portal_url: string | null
          prep_year_required: boolean | null
          priority_score: number | null
          program_id: string | null
          program_name_ar: string | null
          program_name_en: string | null
          pte_min: number | null
          publish_status: string | null
          ranking: number | null
          ranking_system: string | null
          ranking_year: number | null
          research_score: number | null
          scholarship_available: boolean | null
          scholarship_type: string | null
          study_mode: string | null
          teaching_score: number | null
          tuition_basis: string | null
          tuition_is_free: boolean | null
          tuition_usd_program_total_max: number | null
          tuition_usd_program_total_min: number | null
          tuition_usd_semester_max: number | null
          tuition_usd_semester_min: number | null
          tuition_usd_year_max: number | null
          tuition_usd_year_min: number | null
          university_display_name_i18n: Json | null
          university_id: string | null
          university_logo: string | null
          university_name_ar: string | null
          university_name_en: string | null
          world_rank: number | null
        }
        Relationships: []
      }
      vw_scholarship_search: {
        Row: {
          amount: number | null
          country_id: string | null
          country_name: string | null
          country_slug: string | null
          currency_code: string | null
          deadline: string | null
          degree_id: string | null
          degree_name: string | null
          degree_slug: string | null
          id: string | null
          provider_name: string | null
          status: string | null
          title: string | null
          university_city: string | null
          university_id: string | null
          university_logo: string | null
          university_name: string | null
          url: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scholarships_degree_id_fkey"
            columns: ["degree_id"]
            isOneToOne: false
            referencedRelation: "degrees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_scholarship_search_api: {
        Row: {
          academic_year: string | null
          acceptance_rate: number | null
          amount_type: string | null
          amount_value: number | null
          beneficiaries_count: number | null
          country_code: string | null
          country_id: string | null
          country_name_ar: string | null
          country_name_en: string | null
          country_slug: string | null
          coverage: Json | null
          coverage_type: string | null
          created_at: string | null
          currency_code: string | null
          deadline: string | null
          degree_id: string | null
          degree_name: string | null
          degree_slug: string | null
          description: string | null
          eligibility: string[] | null
          image_url: string | null
          is_active: boolean | null
          link: string | null
          percent_value: number | null
          provider: string | null
          rating: number | null
          scholarship_id: string | null
          source: string | null
          source_name: string | null
          status: string | null
          study_level: string | null
          title: string | null
          university_id: string | null
          university_logo: string | null
          university_name: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scholarships_degree_id_fkey"
            columns: ["degree_id"]
            isOneToOne: false
            referencedRelation: "degrees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_scholarships_public: {
        Row: {
          amount: number | null
          application_url: string | null
          coverage_type: string | null
          currency_code: string | null
          deadline: string | null
          deadline_status: string | null
          degree_level: string | null
          description: string | null
          eligibility: string[] | null
          id: string | null
          published_at: string | null
          title: string | null
          university_id: string | null
          university_logo: string | null
          university_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_slider_active: {
        Row: {
          alt_text: string | null
          id: number | null
          image_url: string | null
          locale: string | null
          logo_url: string | null
          university_id: string | null
          university_name: string | null
          university_slug: string | null
          weight: number | null
        }
        Relationships: [
          {
            foreignKeyName: "slider_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "slider_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "slider_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slider_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "slider_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "slider_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "slider_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "slider_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "slider_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slider_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "slider_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "slider_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_university_card: {
        Row: {
          acceptance_rate: number | null
          annual_fees: number | null
          city: string | null
          country_id: string | null
          country_name: string | null
          country_slug: string | null
          currency_code: string | null
          degree_ids: string[] | null
          description: string | null
          description_ar: string | null
          dorm_price_monthly_local: number | null
          enrolled_students: number | null
          has_dorm: boolean | null
          id: string | null
          image_url: string | null
          logo_url: string | null
          min_duration_months: number | null
          min_ielts_required: number | null
          monthly_living: number | null
          name: string | null
          name_ar: string | null
          name_en: string | null
          next_intake_date: string | null
          program_count: number | null
          qs_national_rank: number | null
          qs_world_rank: number | null
          tuition_usd_max: number | null
          tuition_usd_min: number | null
          uniranks_national_rank: number | null
          university_type: string | null
          world_rank: number | null
        }
        Relationships: []
      }
      vw_university_catalog: {
        Row: {
          country_iso: string | null
          duration_semesters: number | null
          intakes: string | null
          level: string | null
          program_id: string | null
          program_name: string | null
          requirements: string | null
          study_language: string | null
          tuition_per_year: number | null
          university_id: string | null
          university_name: string | null
        }
        Relationships: []
      }
      vw_university_details: {
        Row: {
          about_text: string | null
          acceptance_rate: number | null
          address: string | null
          annual_fees: number | null
          city: string | null
          country_id: string | null
          country_name: string | null
          country_slug: string | null
          currency_code: string | null
          description: string | null
          description_ar: string | null
          dorm_price_monthly_local: number | null
          email: string | null
          enrolled_students: number | null
          faculty_count: number | null
          founded_year: number | null
          has_dorm: boolean | null
          hero_image_url: string | null
          institution_type: string | null
          intl_student_count: number | null
          logo_url: string | null
          main_image_url: string | null
          monthly_living: number | null
          next_program_intake: string | null
          phone: string | null
          programs_count: number | null
          qs_indicators: Json | null
          qs_national_rank: number | null
          qs_overall_score: number | null
          qs_ranking_year: number | null
          qs_subject_rankings: Json | null
          qs_world_rank: number | null
          ranking: number | null
          rector_image_url: string | null
          rector_message: string | null
          rector_name: string | null
          rector_title: string | null
          social_links: Json | null
          student_count: number | null
          uniranks_national_rank: number | null
          uniranks_rank: number | null
          university_id: string | null
          university_name: string | null
          university_name_ar: string | null
          university_name_en: string | null
          university_type: string | null
          website: string | null
        }
        Relationships: []
      }
      vw_university_program_signals: {
        Row: {
          degree_ids: string[] | null
          min_duration_months: number | null
          min_ielts_required: number | null
          next_intake_date: string | null
          program_count: number | null
          tuition_usd_max: number | null
          tuition_usd_min: number | null
          university_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "mv_university_catalog_fts"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "programs_view"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_program_search_api_v3_final"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_slider_active"
            referencedColumns: ["university_slug"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_card"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_catalog"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_details"
            referencedColumns: ["university_id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "vw_university_search"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_university_search: {
        Row: {
          annual_fees: number | null
          city: string | null
          country_id: string | null
          country_name: string | null
          country_slug: string | null
          description: string | null
          id: string | null
          image_url: string | null
          is_active: boolean | null
          logo_url: string | null
          monthly_living: number | null
          name: string | null
          ranking: number | null
          website: string | null
        }
        Relationships: []
      }
      vw_visitors_daily: {
        Row: {
          day: string | null
          visitors: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_bulk_update_cities: {
        Args: { p_cities: string[]; p_names: string[] }
        Returns: Json
      }
      admin_dashboard_summary: { Args: never; Returns: Json }
      admin_list_applications: {
        Args: never
        Returns: {
          country_slug: string
          created_at: string
          degree_slug: string
          documents_count: number
          email: string
          full_name: string
          id: string
          language: string
          phone: string
          programs_count: number
          status: string
        }[]
      }
      admin_list_universities:
        | {
            Args: {
              p_country_id?: string
              p_has_city?: boolean
              p_has_country?: boolean
              p_is_active?: boolean
              p_page?: number
              p_page_size?: number
              p_search?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_country_id?: string
              p_has_country?: boolean
              p_is_active?: boolean
              p_page?: number
              p_page_size?: number
              p_search?: string
            }
            Returns: Json
          }
      admin_merge_program_draft: { Args: { draft_id: number }; Returns: Json }
      admin_merge_scholarship_draft: {
        Args: { draft_id: number }
        Returns: Json
      }
      admin_merge_university_draft: {
        Args: { draft_id: number }
        Returns: Json
      }
      app_add_status: {
        Args: {
          p_application_id: string
          p_created_by: string
          p_note: string
          p_status: string
        }
        Returns: undefined
      }
      app_docs_approve_all: {
        Args: { p_application_id: string; p_reviewer_id: string }
        Returns: Json
      }
      app_docs_reject: {
        Args: {
          p_application_id: string
          p_reason: string
          p_reviewer_id: string
        }
        Returns: Json
      }
      app_payment_success: {
        Args: {
          p_amount: number
          p_application_id: string
          p_currency?: string
          p_payment_ref: string
        }
        Returns: Json
      }
      calculate_country_quality_score: {
        Args: { p_country_code: string }
        Returns: number
      }
      check_daily_application_limit: {
        Args: { p_visitor_id: string }
        Returns: boolean
      }
      check_is_admin: { Args: { check_user_id: string }; Returns: boolean }
      check_rate_limit: {
        Args: {
          p_domain: string
          p_endpoint?: string
          p_max_requests?: number
          p_window_seconds?: number
        }
        Returns: boolean
      }
      clean_old_events: { Args: never; Returns: undefined }
      cleanup_expired_otp_codes: { Args: never; Returns: undefined }
      compute_recommendations: {
        Args: { p_limit?: number; p_user?: string; p_visitor?: string }
        Returns: {
          program_id: string
          reason: string
          score: number
        }[]
      }
      compute_recommendations_v2: {
        Args: {
          p_audience?: string
          p_filters?: Json
          p_limit?: number
          p_user_id?: string
          p_visitor_id?: string
        }
        Returns: {
          guidance: Json
          program_id: string
          reason_codes: string[]
          score: number
        }[]
      }
      decision_analytics: { Args: never; Returns: Json }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_service_selection:
        | {
            Args: {
              p_auth_user_id: string
              p_country_code: string
              p_state_rev: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_auth_user_id: string
              p_country_code: string
              p_state_rev: number
            }
            Returns: Json
          }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      fees_verdict: {
        Args: {
          ref_amount: number
          ref_currency: string
          ref_updated_at: string
          scraped_amount: number
          scraped_currency: string
        }
        Returns: Json
      }
      fn_student_progress_from_substage: {
        Args: { s: string }
        Returns: number
      }
      get_countries_with_stats: {
        Args: never
        Returns: {
          country_id: string
          programs_count: number
          ranked_universities_count: number
          universities_count: number
        }[]
      }
      get_country_top_universities: {
        Args: { p_country_slug: string }
        Returns: {
          annual_fees: number
          city: string
          country_slug: string
          logo_url: string
          monthly_living: number
          ranking: number
          university_id: string
          university_name: string
        }[]
      }
      get_program_university_id: {
        Args: { _program_id: string }
        Returns: string
      }
      get_schema_info: { Args: never; Returns: Json }
      get_system_health: { Args: never; Returns: Json }
      get_system_health_v2: { Args: never; Returns: Json }
      get_template_for_doc_slot: {
        Args: { p_doc_slot: string }
        Returns: string
      }
      get_translation_price_config: { Args: never; Returns: Json }
      get_upcoming_deadlines: {
        Args: { p_user_id: string }
        Returns: {
          days_remaining: number
          next_intake: string
          program_id: string
          title: string
          university_name: string
        }[]
      }
      has_page_role: {
        Args: {
          _roles: Database["public"]["Enums"]["university_page_role"][]
          _university_id: string
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_text: {
        Args: { _role: string; _user_id: string }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_comm_participant: {
        Args: { _thread_id: string; _user_id: string }
        Returns: boolean
      }
      is_friendship_member: {
        Args: { _friendship_id: string; _user_id: string }
        Returns: boolean
      }
      is_official_domain_url: {
        Args: { p_university_id: string; p_url: string }
        Returns: boolean
      }
      is_page_staff: {
        Args: { _university_id: string; _user_id: string }
        Returns: boolean
      }
      is_site_readonly: { Args: never; Returns: boolean }
      is_university_page_staff: {
        Args: { _university_id: string; _user_id: string }
        Returns: boolean
      }
      kb_require_column: {
        Args: { col: string; view_name: string }
        Returns: undefined
      }
      kb_require_table: { Args: { regclass_name: string }; Returns: undefined }
      link_visitor_to_user: {
        Args: { p_user: string; p_visitor: string }
        Returns: undefined
      }
      log_unis_event: {
        Args: {
          p_context?: Json
          p_duration_ms?: number
          p_event_type: string
          p_job_id?: string
          p_user_id: string
        }
        Returns: undefined
      }
      map_degree_text_to_id: { Args: { p_text: string }; Returns: string }
      map_subject_to_discipline_id: {
        Args: { p_subject: string }
        Returns: string
      }
      mirror_service_selection: {
        Args: {
          p_auth_user_id: string
          p_country_code: string
          p_pay_plan?: string
          p_pricing_snapshot?: Json
          p_pricing_version?: string
          p_selected_addons?: string[]
          p_selected_package_id?: string
          p_selected_services?: string[]
          p_source?: string
          p_state_rev?: number
          p_status?: string
        }
        Returns: Json
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      orx_transition_fact: {
        Args: {
          _fact_id: string
          _reason?: string
          _to_status: string
          _transitioned_by?: string
        }
        Returns: Json
      }
      osc_auto_tick: { Args: never; Returns: undefined }
      populate_review_queue_from_job: {
        Args: { p_job_id: number }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      refresh_mv_unicat_fts: { Args: never; Returns: undefined }
      resolve_locale: {
        Args: {
          _entity_id: string
          _entity_type: string
          _fallback_locale?: string
          _field_name: string
          _locale: string
          _max_quality_tier?: number
        }
        Returns: {
          fallback_used: boolean
          locale_served: string
          quality_tier: number
          review_status: string
          translated_text: string
        }[]
      }
      resolve_locale_batch: {
        Args: {
          _entity_id: string
          _entity_type: string
          _fallback_locale?: string
          _field_names: string[]
          _locale: string
          _max_quality_tier?: number
        }
        Returns: {
          fallback_used: boolean
          field_name: string
          locale_served: string
          quality_tier: number
          review_status: string
          translated_text: string
        }[]
      }
      rollup_events_daily: { Args: never; Returns: undefined }
      rpc_admin_door2_list_runs: { Args: never; Returns: Json }
      rpc_admin_door2_review_countries: {
        Args: { p_filters?: Json }
        Returns: Json
      }
      rpc_admin_door2_review_queue: {
        Args: { p_filters?: Json; p_page?: number; p_page_size?: number }
        Returns: Json
      }
      rpc_admin_door2_unpublished_draft_ids: {
        Args: { p_filters?: Json }
        Returns: {
          id: number
        }[]
      }
      rpc_admin_osc_review_countries: {
        Args: { p_filters?: Json }
        Returns: Json
      }
      rpc_admin_osc_review_universities: {
        Args: {
          p_country_code: string
          p_filters?: Json
          p_limit?: number
          p_offset?: number
        }
        Returns: Json
      }
      rpc_channel_guard_evidence: {
        Args: { p_minutes?: number }
        Returns: Json
      }
      rpc_check_off_domain_urls: {
        Args: never
        Returns: {
          off_domain_count: number
        }[]
      }
      rpc_city_backfill_from_staging: { Args: never; Returns: Json }
      rpc_claim_translation_jobs: {
        Args: { p_limit: number }
        Returns: {
          attempts: number
          created_at: string
          entity_id: string
          entity_type: string
          field_name: string
          id: string
          last_error: string | null
          priority: number
          processed_at: string | null
          source_lang: string
          source_text: string
          started_at: string | null
          status: string
          target_lang: string
        }[]
        SetofOptions: {
          from: "*"
          to: "translation_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      rpc_cleanup_hmac_nonces: { Args: { p_minutes?: number }; Returns: number }
      rpc_crawl_batch_summary: { Args: { p_batch_id: string }; Returns: Json }
      rpc_d4_field_progress: { Args: never; Returns: Json }
      rpc_d4_progress_website: { Args: never; Returns: Json }
      rpc_d4_publish_enrichment: {
        Args: { p_draft_id: string; p_force?: boolean }
        Returns: Json
      }
      rpc_d4_publish_enrichment_internal: {
        Args: { p_draft_id: string; p_force?: boolean }
        Returns: Json
      }
      rpc_d4_select_enrichment_targets: {
        Args: {
          p_cooldown_hours?: number
          p_field_name?: string
          p_limit?: number
        }
        Returns: {
          last_attempt_at: string
          programs_count: number
          uniranks_rank: number
          uniranks_slug: string
          university_id: string
          university_name: string
        }[]
      }
      rpc_d4_select_targets: {
        Args: { p_field_name: string; p_limit: number }
        Returns: {
          country_code: string
          uniranks_rank: number
          uniranks_slug: string
          university_id: string
          university_name: string
        }[]
      }
      rpc_d5_batch_publish: {
        Args: { program_ids: string[] }
        Returns: {
          already_count: number
          published_count: number
        }[]
      }
      rpc_d5_mark_phase_done: {
        Args: { p_external_id: string; p_phase: string; p_source_name: string }
        Returns: undefined
      }
      rpc_d5_reset_phases: { Args: never; Returns: Json }
      rpc_door2_batch_progress: {
        Args: { p_university_ids: string[] }
        Returns: {
          crawl_stage: string
          drafts_count: number
          has_degree: number
          has_ielts: number
          has_tuition: number
          programs_extracted: number
          programs_failed: number
          programs_pending: number
          programs_total: number
          uniranks_rank: number
          university_id: string
          university_name: string
        }[]
      }
      rpc_door2_pick_sequential_batch: {
        Args: { p_batch_size?: number }
        Returns: string[]
      }
      rpc_door2_progress: { Args: never; Returns: Json }
      rpc_door2_stage_counts: {
        Args: never
        Returns: {
          cnt: number
          stage: string
        }[]
      }
      rpc_force_publish_geo_after_manual_review: {
        Args: {
          p_actor_id: string
          p_override_lat?: number
          p_override_lon?: number
          p_reason: string
          p_row_id: string
          p_trace_id: string
        }
        Returns: Json
      }
      rpc_force_publish_ru_programs: { Args: never; Returns: Json }
      rpc_geo_cache_lookup: {
        Args: { p_keys: string[] }
        Returns: {
          bbox: Json
          city_name: string
          confidence: number
          country_code: string
          entity_id: string
          entity_type: string
          lat: number
          lon: number
          normalized_query_key: string
          resolution_level: string
          source: string
        }[]
      }
      rpc_geo_cache_upsert: { Args: { p_entries: Json }; Returns: number }
      rpc_geo_lock_batch: {
        Args: { p_job_id: string; p_lease?: string; p_limit?: number }
        Returns: {
          city_match: boolean | null
          confidence: number | null
          coordinates_match: boolean | null
          country_match: boolean | null
          created_at: string
          current_city: string | null
          current_country_code: string | null
          has_reference_city_coordinates: boolean | null
          id: string
          issues: string[]
          job_id: string
          lease_owner: string | null
          lock_expires_at: string | null
          locked_at: string | null
          processed_at: string | null
          raw_data: Json | null
          resolution_source: string | null
          resolved_address: string | null
          resolved_city: string | null
          resolved_country_code: string | null
          resolved_lat: number | null
          resolved_lon: number | null
          status: string
          trace_id: string | null
          university_id: string
          university_name: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "geo_verification_rows"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      rpc_get_crawl_review_queue: {
        Args: { p_filters?: Json; p_page?: number; p_page_size?: number }
        Returns: Json
      }
      rpc_get_door2_live: {
        Args: { p_filters?: Json; p_page?: number; p_page_size?: number }
        Returns: Json
      }
      rpc_get_or_create_sandbox_customer_for_staff: {
        Args: never
        Returns: string
      }
      rpc_get_review_countries: { Args: { p_filters?: Json }; Returns: Json }
      rpc_get_uniranks_signals: {
        Args: { p_university_id: string }
        Returns: Json
      }
      rpc_get_university_review:
        | { Args: { p_university_id: string }; Returns: Json }
        | {
            Args: {
              p_program_page?: number
              p_program_page_size?: number
              p_university_id: string
            }
            Returns: Json
          }
      rpc_increment_batch_counters: {
        Args: {
          p_batch_id: string
          p_programs_auto_ready?: number
          p_programs_deep_review?: number
          p_programs_discovered?: number
          p_programs_extracted?: number
          p_programs_published?: number
          p_programs_quick_review?: number
        }
        Returns: undefined
      }
      rpc_increment_batch_programs_discovered: {
        Args: { p_batch_id: string; p_delta: number }
        Returns: undefined
      }
      rpc_increment_batch_programs_extracted: {
        Args: { p_batch_id: string; p_delta: number }
        Returns: undefined
      }
      rpc_kb_programs_search_v1_3_final: {
        Args: { payload: Json }
        Returns: Json
      }
      rpc_link_my_auth: { Args: never; Returns: string }
      rpc_lock_door2_program_urls:
        | {
            Args: { p_limit?: number; p_locked_by?: string }
            Returns: {
              id: number
              kind: string
              university_id: string
              url: string
            }[]
          }
        | {
            Args: {
              p_limit?: number
              p_locked_by?: string
              p_university_ids?: string[]
            }
            Returns: {
              id: number
              kind: string
              university_id: string
              url: string
            }[]
          }
      rpc_lock_program_urls_for_fetch: {
        Args: { p_batch_id: string; p_limit: number; p_locked_by: string }
        Returns: {
          id: number
          kind: string
          university_id: string
          url: string
        }[]
      }
      rpc_lock_program_urls_for_fetch_batchless: {
        Args: { p_limit?: number; p_locked_by?: string }
        Returns: {
          attempts: number | null
          batch_id: string | null
          canonical_url: string | null
          created_at: string | null
          discovered_from: string | null
          fetch_error: string | null
          host_key: string | null
          id: number
          kind: string | null
          lease_expires_at: string | null
          locked_at: string | null
          locked_by: string | null
          raw_page_id: number | null
          retry_at: string | null
          status: string | null
          university_id: string | null
          url: string
          url_hash: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "program_urls"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      rpc_lock_universities_for_batch: {
        Args: { p_limit: number; p_worker: string }
        Returns: {
          university_id: string
        }[]
      }
      rpc_lock_universities_for_discovery: {
        Args: { p_limit: number; p_worker: string }
        Returns: {
          university_id: string
          website: string
        }[]
      }
      rpc_lock_universities_for_website_resolution: {
        Args: { p_limit: number; p_worker: string }
        Returns: {
          cwur_profile_url: string
          university_id: string
        }[]
      }
      rpc_lock_urls_for_extraction: {
        Args: { p_batch_id: string; p_limit: number; p_locked_by?: string }
        Returns: {
          kind: string
          raw_page_id: number
          text_content: string
          university_id: string
          url: string
          url_id: number
        }[]
      }
      rpc_lock_urls_for_extraction_batchless: {
        Args: { p_limit?: number; p_locked_by?: string }
        Returns: {
          raw_page_id: number
          text_content: string
          university_id: string
          url: string
          url_id: number
        }[]
      }
      rpc_map_city_summary: {
        Args: {
          p_country_code: string
          p_degree_slug?: string
          p_fees_max?: number
        }
        Returns: {
          city: string
          city_lat: number
          city_lon: number
          fee_max: number
          fee_min: number
          programs_count: number
          universities_count: number
        }[]
      }
      rpc_map_city_universities: {
        Args: {
          p_city: string
          p_country_code: string
          p_degree_slug?: string
          p_fees_max?: number
        }
        Returns: {
          city: string
          dorm_address: string
          dorm_currency_code: string
          dorm_lat: number
          dorm_lon: number
          dorm_price_monthly_local: number
          fee_max: number
          fee_min: number
          geo_lat: number
          geo_lon: number
          geo_source: string
          has_dorm: boolean
          programs_count: number
          university_id: string
          university_logo: string
          university_name_ar: string
          university_name_en: string
        }[]
      }
      rpc_map_country_summary: {
        Args: { p_degree_slug?: string; p_fees_max?: number }
        Returns: {
          country_code: string
          country_name_ar: string
          country_name_en: string
          fee_max: number
          fee_min: number
          programs_count: number
          universities_count: number
        }[]
      }
      rpc_map_country_universities: {
        Args: {
          p_country_code: string
          p_degree_slug?: string
          p_fees_max?: number
        }
        Returns: {
          city: string
          dorm_address: string
          dorm_currency_code: string
          dorm_lat: number
          dorm_lon: number
          dorm_price_monthly_local: number
          fee_max: number
          fee_min: number
          geo_lat: number
          geo_lon: number
          geo_source: string
          has_dorm: boolean
          programs_count: number
          university_id: string
          university_logo: string
          university_name_ar: string
          university_name_en: string
        }[]
      }
      rpc_migrate_uniranks_website_to_profile: {
        Args: { p_limit?: number }
        Returns: Json
      }
      rpc_notarized_apply_payment_event: {
        Args: {
          p_event_type: string
          p_payment_id: string
          p_provider: string
          p_provider_event_id: string
          p_provider_payment_id?: string
          p_raw_payload?: Json
          p_status: string
        }
        Returns: Json
      }
      rpc_notarized_job_enqueue: {
        Args: { p_job_id: string; p_stage?: string }
        Returns: Json
      }
      rpc_notarized_job_set_precheck: {
        Args: {
          p_doc_type_confidence: number
          p_doc_type_guess: string
          p_fix_tips: string[]
          p_job_id: string
          p_ok: boolean
          p_page_count: number
          p_quality_flags: string[]
          p_quality_score: number
          p_rejection_code: string
          p_rejection_reasons: string[]
        }
        Returns: Json
      }
      rpc_notarized_job_set_status: {
        Args: {
          p_job_id: string
          p_meta_json?: Json
          p_paths_json?: Json
          p_status: string
        }
        Returns: Json
      }
      rpc_notarized_order_create: {
        Args: {
          p_customer_id: string
          p_delivery_mode?: string
          p_doc_slots?: string[]
          p_notify_channels?: string[]
        }
        Returns: Json
      }
      rpc_notarized_order_mark_paid: {
        Args: { p_order_id: string; p_payment_ref?: string }
        Returns: Json
      }
      rpc_notarized_payment_start: {
        Args: { p_idempotency_key?: string; p_quote_id: string }
        Returns: Json
      }
      rpc_notarized_presign_upload: {
        Args: {
          p_content_type?: string
          p_ext: string
          p_job_id: string
          p_order_id: string
        }
        Returns: Json
      }
      rpc_notarized_purge_expired: { Args: never; Returns: Json }
      rpc_notarized_queue_lock:
        | { Args: { p_limit?: number; p_worker_id: string }; Returns: Json }
        | {
            Args: { p_limit?: number; p_stage?: string; p_worker_id: string }
            Returns: {
              attempts: number
              job_id: string
              queue_id: string
              stage: string
            }[]
          }
      rpc_notarized_queue_release:
        | {
            Args: {
              p_error?: string
              p_job_id: string
              p_next_stage?: string
              p_stage?: string
              p_success: boolean
            }
            Returns: Json
          }
        | { Args: { p_queue_id: string; p_success?: boolean }; Returns: Json }
      rpc_notarized_quote_accept: {
        Args: { p_quote_id: string }
        Returns: Json
      }
      rpc_notarized_quote_calc: {
        Args: { p_country_code?: string; p_order_id: string }
        Returns: Json
      }
      rpc_notarized_quote_create: {
        Args: { p_order_id: string }
        Returns: Json
      }
      rpc_notarized_quote_get: { Args: { p_order_id: string }; Returns: Json }
      rpc_notarized_upload_complete: {
        Args: {
          p_job_id: string
          p_original_meta: Json
          p_original_path: string
        }
        Returns: Json
      }
      rpc_osc_claim_rows: {
        Args: { p_batch_size?: number; p_job_id: string; p_worker_id: string }
        Returns: {
          artifacts_path: string | null
          completeness_by_section: Json | null
          completeness_score: number | null
          country_code: string | null
          coverage_plan: Json | null
          coverage_result: Json | null
          crawl_status: string
          crawl_strategy: string | null
          created_at: string
          discovery_passes: Json | null
          error_message: string | null
          extracted_summary: Json | null
          id: string
          job_id: string
          locked_at: string | null
          locked_by: string | null
          pages_mapped: number | null
          pages_scraped: number | null
          reason_codes: string[] | null
          university_id: string
          university_name: string | null
          updated_at: string
          website: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "official_site_crawl_rows"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      rpc_osc_claim_tick_lease: {
        Args: { p_job_id: string; p_owner: string; p_ttl_seconds?: number }
        Returns: boolean
      }
      rpc_osc_pick_batch: {
        Args: { p_batch_size?: number; p_job_id: string; p_worker_id?: string }
        Returns: {
          artifacts_path: string | null
          completeness_by_section: Json | null
          completeness_score: number | null
          country_code: string | null
          coverage_plan: Json | null
          coverage_result: Json | null
          crawl_status: string
          crawl_strategy: string | null
          created_at: string
          discovery_passes: Json | null
          error_message: string | null
          extracted_summary: Json | null
          id: string
          job_id: string
          locked_at: string | null
          locked_by: string | null
          pages_mapped: number | null
          pages_scraped: number | null
          reason_codes: string[] | null
          university_id: string
          university_name: string | null
          updated_at: string
          website: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "official_site_crawl_rows"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      rpc_osc_release_tick_lease: {
        Args: { p_job_id: string; p_owner: string }
        Returns: undefined
      }
      rpc_osc_sync_job_counters: {
        Args: { p_job_id: string }
        Returns: undefined
      }
      rpc_osc_update_row: {
        Args: {
          p_artifacts_path?: string
          p_coverage_result?: Json
          p_error_message?: string
          p_extracted_summary?: Json
          p_reason_codes?: string[]
          p_row_id: string
          p_status: string
        }
        Returns: undefined
      }
      rpc_pick_door2_candidates:
        | {
            Args: { p_limit?: number }
            Returns: {
              stage: string
              uniranks_profile_url: string
              university_id: string
            }[]
          }
        | {
            Args: { p_max_units?: number; p_now?: string }
            Returns: {
              stage: string
              uniranks_profile_url: string
              university_id: string
            }[]
          }
      rpc_promote_file_fee_observations_to_draft: {
        Args: { _dry_run?: boolean; _university_id?: string }
        Returns: Json
      }
      rpc_promote_language_observations: {
        Args: { _dry_run?: boolean; _university_id?: string }
        Returns: Json
      }
      rpc_promote_program_admissions_to_draft: {
        Args: { p_university_id?: string }
        Returns: Json
      }
      rpc_promote_program_brochure_observations: { Args: never; Returns: Json }
      rpc_promote_program_language_to_draft: {
        Args: { _dry_run?: boolean; _job_id?: string; _university_id?: string }
        Returns: Json
      }
      rpc_publish_eu_admissions: {
        Args: { p_trace_id?: string; p_university_id: string }
        Returns: Json
      }
      rpc_publish_program_admissions_text_from_draft: {
        Args: { p_draft_id: number; p_program_id: string }
        Returns: Json
      }
      rpc_publish_program_batch: {
        Args: { p_batch_id: string }
        Returns: {
          error_count: number
          published_count: number
          skipped_count: number
        }[]
      }
      rpc_publish_program_batch_search:
        | {
            Args: { p_batch_id: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.rpc_publish_program_batch_search(p_batch_id => text), public.rpc_publish_program_batch_search(p_batch_id => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"[]
          }
        | {
            Args: { p_batch_id: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.rpc_publish_program_batch_search(p_batch_id => text), public.rpc_publish_program_batch_search(p_batch_id => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"[]
          }
      rpc_publish_program_deadline_from_draft: {
        Args: { p_draft_id: number; p_program_id: string }
        Returns: Json
      }
      rpc_publish_program_ects_from_draft: {
        Args: { p_draft_id: number; p_program_id: string }
        Returns: Json
      }
      rpc_publish_program_entry_reqs_from_draft: {
        Args: { p_draft_id: number; p_program_id: string }
        Returns: Json
      }
      rpc_publish_program_intake_from_draft: {
        Args: { p_draft_id: number; p_program_id: string }
        Returns: Json
      }
      rpc_publish_program_language_from_draft: {
        Args: { p_draft_id: number; p_program_id: string }
        Returns: Json
      }
      rpc_publish_programs:
        | {
            Args: { p_program_draft_ids: number[]; p_trace_id?: string }
            Returns: Json
          }
        | {
            Args: { p_program_draft_ids: string[]; p_trace_id?: string }
            Returns: Json
          }
      rpc_publish_university: {
        Args: { p_options?: Json; p_trace_id?: string; p_university_id: string }
        Returns: Json
      }
      rpc_publish_university_contacts: {
        Args: { p_trace_id?: string; p_university_id: string }
        Returns: Json
      }
      rpc_publish_university_file_fees: {
        Args: { _dry_run?: boolean; _university_id?: string }
        Returns: Json
      }
      rpc_publish_university_offices: {
        Args: { p_trace_id?: string; p_university_id: string }
        Returns: Json
      }
      rpc_publish_verified_batchless: {
        Args: { p_limit?: number }
        Returns: Json
      }
      rpc_publish_verified_university_geo: {
        Args: {
          p_actor_id: string
          p_reason?: string
          p_row_id: string
          p_trace_id: string
        }
        Returns: Json
      }
      rpc_quarantine_universities_without_country: {
        Args: never
        Returns: {
          quarantined_count: number
          remaining_active: number
          sample_ids: string[]
        }[]
      }
      rpc_reject_verified_university_geo: {
        Args: {
          p_actor_id: string
          p_reason?: string
          p_row_id: string
          p_trace_id: string
        }
        Returns: Json
      }
      rpc_repair_cwur_profile_urls: {
        Args: { p_limit?: number }
        Returns: Json
      }
      rpc_requeue_stale_translation_jobs: {
        Args: { p_stale_minutes?: number }
        Returns: number
      }
      rpc_reset_stuck_locks: { Args: never; Returns: Json }
      rpc_reset_uniranks_university: {
        Args: { p_trace_id?: string; p_university_id: string }
        Returns: Json
      }
      rpc_seed_door2_crawl_state: {
        Args: { p_batch_size?: number }
        Returns: Json
      }
      rpc_seed_program_urls_from_gap: {
        Args: { p_batch_id: string; p_limit: number }
        Returns: number
      }
      rpc_set_crawl_paused: { Args: { p_paused: boolean }; Returns: Json }
      rpc_set_crawl_policy: { Args: { p_policy: Json }; Returns: undefined }
      rpc_set_primary_university_housing: {
        Args: {
          p_actor_id: string
          p_housing_id: string
          p_reason?: string
          p_trace_id: string
        }
        Returns: Json
      }
      rpc_set_review_status: {
        Args: {
          p_ids: string[]
          p_status: string
          p_target_type: string
          p_trace_id?: string
        }
        Returns: Json
      }
      rpc_set_university_crawl_progress: {
        Args: {
          p_description?: string
          p_error_json?: Json
          p_pages_done?: number
          p_pages_total?: number
          p_status: string
          p_trace_id?: string
          p_uniranks_rank?: number
          p_uniranks_score?: number
          p_university_id: string
        }
        Returns: Json
      }
      rpc_set_university_logo: {
        Args: { p_logo_url: string; p_source: string; p_university_id: string }
        Returns: undefined
      }
      rpc_set_university_website: {
        Args: {
          p_confidence?: number
          p_etld1: string
          p_source: string
          p_university_id: string
          p_website: string
        }
        Returns: Json
      }
      rpc_shortlist_add: { Args: { p_program_id: string }; Returns: Json }
      rpc_shortlist_list: { Args: never; Returns: Json }
      rpc_shortlist_remove: { Args: { p_program_id: string }; Returns: Json }
      rpc_student_profile_by_session: {
        Args: never
        Returns: {
          activation_status: string
          avatar_storage_path: string | null
          city: string | null
          country: string | null
          created_at: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string | null
          is_sandbox: boolean
          national_id: string | null
          phone: string | null
          sandbox_owner: string | null
          student_progress: number | null
          student_substage: string | null
          updated_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rpc_student_update_profile:
        | {
            Args: {
              p_address_city?: string
              p_address_country?: string
              p_email?: string
              p_emergency_name?: string
              p_emergency_phone?: string
              p_full_name?: string
              p_national_id?: string
              p_phone?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_address_city?: string
              p_address_country?: string
              p_avatar_path?: string
              p_email?: string
              p_emergency_name?: string
              p_emergency_phone?: string
              p_full_name?: string
              p_national_id?: string
              p_phone?: string
            }
            Returns: undefined
          }
      rpc_translation_quote_accept: {
        Args: { p_quote_id: string }
        Returns: undefined
      }
      rpc_translation_quote_create: {
        Args: { p_order_id: string }
        Returns: Json
      }
      rpc_translation_quote_get: { Args: { p_order_id: string }; Returns: Json }
      rpc_uni_shortlist_add: {
        Args: { p_university_id: string }
        Returns: Json
      }
      rpc_uni_shortlist_list: { Args: never; Returns: Json }
      rpc_uni_shortlist_remove: {
        Args: { p_university_id: string }
        Returns: Json
      }
      rpc_uniranks_backfill_country_for_matched: {
        Args: { p_batch_limit?: number; p_dry_run?: boolean }
        Returns: {
          still_missing: number
          updated_count: number
        }[]
      }
      rpc_upsert_program_url: {
        Args: {
          p_batch_id: string
          p_discovered_from?: string
          p_kind?: string
          p_university_id: string
          p_url: string
        }
        Returns: number
      }
      rpc_upsert_uniranks_signals: {
        Args: {
          p_sections_present?: string[]
          p_signals: Json
          p_snapshot?: Json
          p_trace_id: string
          p_university_id: string
        }
        Returns: Json
      }
      rpc_we_claim_tick_lease: {
        Args: { p_job_id: string; p_owner: string; p_ttl_seconds?: number }
        Returns: boolean
      }
      rpc_we_lock_batch: {
        Args: { p_job_id: string; p_limit: number }
        Returns: {
          attempt_count: number
          city: string | null
          confidence_score: number | null
          country_code: string | null
          created_at: string
          enriched_at: string | null
          enrichment_status: string
          id: string
          job_id: string
          last_error: string | null
          last_stage: string | null
          lease_owner: string | null
          locked_at: string | null
          match_reason: string | null
          match_source: string | null
          matched_city: string | null
          matched_country: string | null
          matched_entity_name: string | null
          needs_manual_review: boolean
          official_website_domain: string | null
          official_website_url: string | null
          processed_at: string | null
          provider_candidates: Json | null
          provider_homepage_url_raw: string | null
          raw_provider_response: Json | null
          review_action: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          university_id: string
          university_name: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "website_enrichment_rows"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      rpc_we_pick_batch: {
        Args: { p_batch_size?: number; p_job_id: string }
        Returns: number
      }
      rpc_we_release_tick_lease: {
        Args: { p_job_id: string; p_owner: string }
        Returns: undefined
      }
      run_double_validation: { Args: { batch_limit?: number }; Returns: Json }
      seo_cron_apply: {
        Args: { _backlinks: boolean; _enable: boolean; _gsc: boolean }
        Returns: Json
      }
      seo_cron_status: { Args: never; Returns: Json }
      seo_last_runs: { Args: never; Returns: Json }
      seo_overview_summary: { Args: never; Returns: Json }
      sync_osc_job_counters: { Args: { p_job_id: string }; Returns: Json }
      test_crypto_basic: { Args: never; Returns: Json }
      tmp_publish_pending_d4: { Args: never; Returns: number }
      to_payment_minor_units: {
        Args: { p_amount: number; p_currency: string }
        Returns: number
      }
      translation_source_hash: { Args: { content: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      comm_participant_role:
        | "student"
        | "university_staff"
        | "teacher"
        | "csw_staff"
        | "system"
      comm_thread_priority: "low" | "normal" | "high" | "urgent"
      comm_thread_status:
        | "open"
        | "awaiting_reply"
        | "assigned"
        | "closed"
        | "archived"
      comm_thread_type:
        | "csw_support"
        | "file_improvement"
        | "university_public_inquiry"
        | "university_qualified_inquiry"
        | "application_thread"
        | "teacher_student"
        | "security_notice"
        | "system_notice"
        | "peer_message"
      comment_mod_action:
        | "hide"
        | "delete"
        | "ban_user"
        | "mute_user"
        | "restrict_user"
      enrichment_fact_status:
        | "candidate"
        | "approved"
        | "published"
        | "rejected"
        | "stale"
        | "superseded"
      inbox_thread_status: "open" | "assigned" | "closed"
      orx_badge:
        | "future_ready"
        | "high_future_relevance"
        | "ai_era_ready"
        | "strong_industry_link"
        | "fast_adapter"
        | "transparent"
      orx_dimension_domain: "core" | "living" | "work_mobility" | "roi" | "fit"
      orx_dimension_fact_status:
        | "candidate"
        | "internal_approved"
        | "published"
        | "rejected"
        | "stale"
        | "superseded"
      orx_entity_type: "university" | "program" | "country"
      orx_evidence_status:
        | "discovered"
        | "fetched"
        | "extracted"
        | "normalized"
        | "accepted"
        | "rejected"
        | "stale"
        | "superseded"
        | "conflicted"
      orx_exposure_status:
        | "internal_only"
        | "beta_candidate"
        | "beta_approved"
        | "blocked_low_confidence"
        | "blocked_missing_layer"
        | "blocked_uncalibrated"
        | "blocked_external_source_issue"
      orx_fact_boundary: "country" | "city" | "institution" | "program"
      orx_source_type:
        | "official_website"
        | "course_catalog"
        | "official_pdf"
        | "structured_data"
        | "government_report"
        | "accreditation_body"
        | "verified_student"
        | "third_party_index"
        | "news_press"
      orx_status: "scored" | "evaluating" | "insufficient"
      orx_trust_level: "high" | "medium" | "low"
      university_page_role:
        | "full_control"
        | "page_admin"
        | "content_publisher"
        | "moderator"
        | "inbox_agent"
        | "analyst"
        | "live_community_manager"
      university_post_status:
        | "draft"
        | "pending_review"
        | "published"
        | "archived"
      university_post_type:
        | "news"
        | "announcement"
        | "scholarship"
        | "seats_available"
        | "application_deadline"
        | "event"
        | "official_update"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      comm_participant_role: [
        "student",
        "university_staff",
        "teacher",
        "csw_staff",
        "system",
      ],
      comm_thread_priority: ["low", "normal", "high", "urgent"],
      comm_thread_status: [
        "open",
        "awaiting_reply",
        "assigned",
        "closed",
        "archived",
      ],
      comm_thread_type: [
        "csw_support",
        "file_improvement",
        "university_public_inquiry",
        "university_qualified_inquiry",
        "application_thread",
        "teacher_student",
        "security_notice",
        "system_notice",
        "peer_message",
      ],
      comment_mod_action: [
        "hide",
        "delete",
        "ban_user",
        "mute_user",
        "restrict_user",
      ],
      enrichment_fact_status: [
        "candidate",
        "approved",
        "published",
        "rejected",
        "stale",
        "superseded",
      ],
      inbox_thread_status: ["open", "assigned", "closed"],
      orx_badge: [
        "future_ready",
        "high_future_relevance",
        "ai_era_ready",
        "strong_industry_link",
        "fast_adapter",
        "transparent",
      ],
      orx_dimension_domain: ["core", "living", "work_mobility", "roi", "fit"],
      orx_dimension_fact_status: [
        "candidate",
        "internal_approved",
        "published",
        "rejected",
        "stale",
        "superseded",
      ],
      orx_entity_type: ["university", "program", "country"],
      orx_evidence_status: [
        "discovered",
        "fetched",
        "extracted",
        "normalized",
        "accepted",
        "rejected",
        "stale",
        "superseded",
        "conflicted",
      ],
      orx_exposure_status: [
        "internal_only",
        "beta_candidate",
        "beta_approved",
        "blocked_low_confidence",
        "blocked_missing_layer",
        "blocked_uncalibrated",
        "blocked_external_source_issue",
      ],
      orx_fact_boundary: ["country", "city", "institution", "program"],
      orx_source_type: [
        "official_website",
        "course_catalog",
        "official_pdf",
        "structured_data",
        "government_report",
        "accreditation_body",
        "verified_student",
        "third_party_index",
        "news_press",
      ],
      orx_status: ["scored", "evaluating", "insufficient"],
      orx_trust_level: ["high", "medium", "low"],
      university_page_role: [
        "full_control",
        "page_admin",
        "content_publisher",
        "moderator",
        "inbox_agent",
        "analyst",
        "live_community_manager",
      ],
      university_post_status: [
        "draft",
        "pending_review",
        "published",
        "archived",
      ],
      university_post_type: [
        "news",
        "announcement",
        "scholarship",
        "seats_available",
        "application_deadline",
        "event",
        "official_update",
      ],
    },
  },
} as const
