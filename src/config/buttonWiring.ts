/**
 * Button Wiring Matrix
 * Central definition of all interactive buttons across the app
 */

export const BUTTON_WIRING = {
  homepage: {
    hero_get_started: {
      id: 'hero_get_started',
      label: 'Get Started',
      action: 'navigate_search',
      route: '/universities?tab=programs',
      telemetry_event: 'button_clicked',
      context: { location: 'hero', slide: 0 }
    },
    hero_explore: {
      id: 'hero_explore',
      label: 'Explore Now',
      action: 'navigate_search',
      route: '/universities?tab=programs',
      telemetry_event: 'button_clicked',
      context: { location: 'hero', slide: 1 }
    },
    hero_ai: {
      id: 'hero_ai',
      label: 'Try AI Assistant',
      action: 'open_chat',
      route: null,
      telemetry_event: 'button_clicked',
      context: { location: 'hero', slide: 2 }
    },
    service_icon: {
      id: 'service_icon',
      label: 'Service Icon',
      action: 'navigate_service',
      route: null, // dynamic
      telemetry_event: 'service_icon_clicked',
      context: { location: 'services' }
    },
    country_card: {
      id: 'country_card',
      label: 'Country Card',
      action: 'navigate_search',
      route: '/search',
      telemetry_event: 'country_card_click',
      context: { location: 'countries' }
    }
  },
  header: {
    sign_in: {
      id: 'header_sign_in',
      label: 'Sign In',
      action: 'navigate_auth',
      route: '/auth',
      telemetry_event: 'button_clicked',
      context: { location: 'header' }
    },
    admin: {
      id: 'header_admin',
      label: 'Admin',
      action: 'navigate_admin',
      route: '/admin',
      telemetry_event: 'button_clicked',
      context: { location: 'header' }
    },
    portal: {
      id: 'header_portal',
      label: 'Personal Space',
      action: 'navigate_portal',
      route: '/portal/contracts',
      telemetry_event: 'button_clicked',
      context: { location: 'header' }
    }
  },
  admin: {
    crm_keys: {
      id: 'admin_crm_keys',
      label: 'CRM Keys',
      action: 'navigate_admin',
      route: '/admin/integrations/crm',
      telemetry_event: 'admin_nav_clicked',
      context: { section: 'quick_actions' }
    },
    outbox: {
      id: 'admin_outbox',
      label: 'Outbox Queue',
      action: 'navigate_admin',
      route: '/admin/integrations/outbox',
      telemetry_event: 'admin_nav_clicked',
      context: { section: 'quick_actions' }
    },
    bot: {
      id: 'admin_bot',
      label: 'University Bot',
      action: 'navigate_admin',
      route: '/admin/ingestion/bot',
      telemetry_event: 'admin_nav_clicked',
      context: { section: 'quick_actions' }
    },
    telemetry: {
      id: 'admin_telemetry',
      label: 'Telemetry',
      action: 'navigate_admin',
      route: '/admin/telemetry',
      telemetry_event: 'admin_nav_clicked',
      context: { section: 'quick_actions' }
    },
    feature_flags: {
      id: 'admin_feature_flags',
      label: 'Feature Flags',
      action: 'navigate_admin',
      route: '/admin/feature-flags',
      telemetry_event: 'admin_nav_clicked',
      context: { section: 'quick_actions' }
    }
  }
} as const;

export type ButtonId = keyof typeof BUTTON_WIRING[keyof typeof BUTTON_WIRING];
