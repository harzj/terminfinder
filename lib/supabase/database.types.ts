export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string
          bgg_username: string | null
          bgg_collection: Json | null
          default_availability_times: Json | null
          availability_planning_months: number
          onboarding_tour_seen_at: string | null
          created_at: string
          calendar_token: string
          calendar_import_url: string | null
          auto_sync_enabled: boolean
          auto_sync_urls: Json
          auto_sync_min_distance_hours: number
        }
        Insert: {
          id: string
          display_name: string
          bgg_username?: string | null
          bgg_collection?: Json | null
          default_availability_times?: Json | null
          availability_planning_months?: number
          onboarding_tour_seen_at?: string | null
          created_at?: string
          calendar_token?: string
          calendar_import_url?: string | null
          auto_sync_enabled?: boolean
          auto_sync_urls?: Json
          auto_sync_min_distance_hours?: number
        }
        Update: {
          id?: string
          display_name?: string
          bgg_username?: string | null
          bgg_collection?: Json | null
          default_availability_times?: Json | null
          availability_planning_months?: number
          onboarding_tour_seen_at?: string | null
          created_at?: string
          calendar_token?: string
          calendar_import_url?: string | null
          auto_sync_enabled?: boolean
          auto_sync_urls?: Json
          auto_sync_min_distance_hours?: number
        }
        Relationships: []
      }
      groups: {
        Row: {
          id: string
          name: string
          description: string | null
          min_participants: number
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          min_participants?: number
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          min_participants?: number
          created_by?: string
          created_at?: string
        }
        Relationships: []
      }
      group_members: {
        Row: {
          id: string
          group_id: string
          user_id: string | null
          email: string
          status: 'pending' | 'active'
          invite_code: string
          invited_by: string | null
          joined_at: string | null
          display_name: string | null
        }
        Insert: {
          id?: string
          group_id: string
          user_id?: string | null
          email: string
          status?: 'pending' | 'active'
          invite_code?: string
          invited_by?: string | null
          joined_at?: string | null
          display_name?: string | null
        }
        Update: {
          id?: string
          group_id?: string
          user_id?: string | null
          email?: string
          status?: 'pending' | 'active'
          invite_code?: string
          invited_by?: string | null
          joined_at?: string | null
          display_name?: string | null
        }
        Relationships: []
      }
      availability: {
        Row: {
          id: string
          user_id: string
          date: string
          status: 'available' | 'uncertain'
          from_time: string | null
          until_time: string | null
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          status: 'available' | 'uncertain'
          from_time?: string | null
          until_time?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          status?: 'available' | 'uncertain'
          from_time?: string | null
          until_time?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          id: string
          group_id: string
          proposed_date: string
          from_time: string | null
          until_time: string | null
          min_participants: number
          status: 'voting' | 'confirmed' | 'expired' | 'cancelled'
          proposed_by: string
          host_user_id: string | null
          notes: string | null
          cancelled_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          group_id: string
          proposed_date: string
          from_time?: string | null
          until_time?: string | null
          min_participants?: number
          status?: 'voting' | 'confirmed' | 'expired' | 'cancelled'
          proposed_by: string
          host_user_id?: string | null
          notes?: string | null
          cancelled_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          proposed_date?: string
          from_time?: string | null
          until_time?: string | null
          min_participants?: number
          status?: 'voting' | 'confirmed' | 'expired' | 'cancelled'
          proposed_by?: string
          host_user_id?: string | null
          notes?: string | null
          cancelled_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      event_responses: {
        Row: {
          id: string
          event_id: string
          user_id: string
          response: 'accepted' | 'declined' | 'uncertain'
          previous_response: 'accepted' | 'declined' | 'uncertain' | null
          host_offer: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          user_id: string
          response?: 'accepted' | 'declined' | 'uncertain'
          previous_response?: 'accepted' | 'declined' | 'uncertain' | null
          host_offer?: boolean
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          user_id?: string
          response?: 'accepted' | 'declined' | 'uncertain'
          previous_response?: 'accepted' | 'declined' | 'uncertain' | null
          host_offer?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      event_games: {
        Row: {
          id: string
          event_id: string
          bgg_id: number | null
          name: string
          thumbnail_url: string | null
          added_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          bgg_id?: number | null
          name: string
          thumbnail_url?: string | null
          added_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          bgg_id?: number | null
          name?: string
          thumbnail_url?: string | null
          added_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      calendar_connections: {
        Row: {
          id: string
          user_id: string
          provider: 'google' | 'microsoft' | 'apple'
          access_token: string
          refresh_token: string | null
          expires_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          provider: 'google' | 'microsoft' | 'apple'
          access_token: string
          refresh_token?: string | null
          expires_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          provider?: 'google' | 'microsoft' | 'apple'
          access_token?: string
          refresh_token?: string | null
          expires_at?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth_key: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          p256dh: string
          auth_key: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          p256dh?: string
          auth_key?: string
          created_at?: string
        }
        Relationships: []
      }
      push_notifications_sent: {
        Row: {
          id: string
          event_id: string
          notification_type: string
          sent_at: string
        }
        Insert: {
          id?: string
          event_id: string
          notification_type: string
          sent_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          notification_type?: string
          sent_at?: string
        }
        Relationships: []
      }
      calendar_sync_state: {
        Row: {
          user_id: string
          date: string
          ics_signature: string
          last_action: string
          last_sync_at: string
          user_changed_at: string | null
        }
        Insert: {
          user_id: string
          date: string
          ics_signature?: string
          last_action?: string
          last_sync_at?: string
          user_changed_at?: string | null
        }
        Update: {
          user_id?: string
          date?: string
          ics_signature?: string
          last_action?: string
          last_sync_at?: string
          user_changed_at?: string | null
        }
        Relationships: []
      }
      calendar_sync_log: {
        Row: {
          id: string
          user_id: string
          date: string
          action: string
          ics_event_summary: string | null
          calendar_url: string | null
          synced_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          action: string
          ics_event_summary?: string | null
          calendar_url?: string | null
          synced_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          action?: string
          ics_event_summary?: string | null
          calendar_url?: string | null
          synced_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
