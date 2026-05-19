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
          created_at: string
        }
        Insert: {
          id: string
          display_name: string
          created_at?: string
        }
        Update: {
          id?: string
          display_name?: string
          created_at?: string
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
          status: 'voting' | 'confirmed' | 'expired'
          proposed_by: string
          created_at: string
        }
        Insert: {
          id?: string
          group_id: string
          proposed_date: string
          from_time?: string | null
          until_time?: string | null
          min_participants?: number
          status?: 'voting' | 'confirmed' | 'expired'
          proposed_by: string
          created_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          proposed_date?: string
          from_time?: string | null
          until_time?: string | null
          min_participants?: number
          status?: 'voting' | 'confirmed' | 'expired'
          proposed_by?: string
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
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          user_id: string
          response?: 'accepted' | 'declined' | 'uncertain'
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          user_id?: string
          response?: 'accepted' | 'declined' | 'uncertain'
          updated_at?: string
        }
        Relationships: []
      }
      event_games: {
        Row: {
          id: string
          event_id: string
          bgg_id: number
          name: string
          thumbnail_url: string | null
          added_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          bgg_id: number
          name: string
          thumbnail_url?: string | null
          added_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          bgg_id?: number
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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
