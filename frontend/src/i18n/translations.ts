export type Language = 'de' | 'en';

export interface Translations {
  // Navigation & Categories
  nav_dashboard: string;
  nav_workloads: string;
  nav_nodes: string;
  nav_users: string;
  nav_audit: string;
  nav_nests: string;
  nav_databases: string;
  nav_settings: string;
  nav_profile: string;
  nav_logout: string;
  cat_operations_core: string;
  cat_community_network: string;
  cat_services_extensions: string;
  cat_security_team: string;
  cat_platform: string;
  cat_administration: string;
  nav_all_servers: string;
  nav_activity: string;
  nav_changelog: string;
  admin_dashboard: string;
  admin_servers: string;
  admin_nodes: string;
  admin_users: string;
  admin_eggs: string;
  admin_databases: string;

  // Server Tabs
  tab_console: string;
  tab_files: string;
  tab_players: string;
  tab_network: string;
  tab_webhooks: string;
  tab_plugins: string;
  tab_game_config: string;
  tab_sidecars: string;
  tab_security: string;
  tab_backups: string;
  tab_schedules: string;
  tab_databases: string;
  tab_users: string;
  tab_audit: string;
  tab_settings: string;

  // Dashboard & Metrics
  dash_cluster_operational: string;
  dash_cluster_hub: string;
  dash_cluster_desc: string;
  dash_deploy_instance: string;
  dash_nodes_matrix: string;
  dash_online_workloads: string;
  dash_wings_daemons: string;
  dash_cluster_compute: string;
  dash_memory_allocation: string;
  dash_active: string;
  dash_offline: string;
  dash_mesh_health: string;
  dash_allocated_load: string;
  dash_capacity: string;
  dash_free: string;
  dash_filter_placeholder: string;
  dash_all: string;
  dash_running: string;
  dash_starting: string;
  dash_stopped: string;
  dash_power_actions: string;
  dash_instance_egg: string;
  dash_node_allocation: string;
  dash_quick_power: string;

  // Power Actions
  power_start: string;
  power_restart: string;
  power_stop: string;
  power_kill: string;

  // Live Chat Relay
  chat_relay_title: string;
  chat_web_minecraft_sync: string;
  chat_privacy_notice: string;
  chat_send_as: string;
  chat_web_admin: string;
  chat_in_game: string;
  chat_system: string;
  chat_type_placeholder: string;
  chat_announcement: string;

  // Settings & Theme
  settings_title: string;
  settings_tab_profile: string;
  settings_tab_2fa: string;
  settings_tab_api_keys: string;
  settings_tab_themes: string;
  settings_tab_backgrounds: string;
  settings_tab_custom_css: string;
  theme_applied: string;
  theme_desc: string;
  bg_effect_title: string;
  bg_effect_desc: string;
  custom_css_title: string;
  custom_css_desc: string;
  custom_css_save: string;
  custom_css_clear: string;
  language_title: string;
  language_de: string;
  language_en: string;

  // Common UI
  common_cancel: string;
  common_save: string;
  common_delete: string;
  common_copied: string;
  common_search: string;
  common_status: string;
}

export const translations: Record<Language, Translations> = {
  de: {
    // Navigation & Kategorien
    nav_dashboard: 'Dashboard',
    nav_workloads: 'Server-Workloads',
    nav_nodes: 'Cluster Nodes',
    nav_users: 'Benutzer & Rollen',
    nav_audit: 'Audit Log',
    nav_nests: 'Nests & Eggs',
    nav_databases: 'Datenbanken',
    nav_settings: 'Einstellungen',
    nav_profile: 'Mein Profil',
    nav_logout: 'Abmelden',
    cat_operations_core: 'Betrieb & System',
    cat_community_network: 'Community & Netzwerk',
    cat_services_extensions: 'Dienste & Erweiterungen',
    cat_security_team: 'Sicherheit & Team',
    cat_platform: 'Plattform',
    cat_administration: 'Administration',
    nav_all_servers: 'Alle Server',
    nav_activity: 'Aktivität & Audit',
    nav_changelog: 'Changelog & Updates',
    admin_dashboard: 'Admin Dashboard',
    admin_servers: 'Server',
    admin_nodes: 'Cluster Nodes',
    admin_users: 'Benutzer',
    admin_eggs: 'Eggs & Nests',
    admin_databases: 'Datenbanken',

    // Server Tabs
    tab_console: 'Konsole',
    tab_files: 'Dateimanager',
    tab_players: 'Spieler & Chat',
    tab_network: 'Netzwerk & Ports',
    tab_webhooks: 'Webhooks & Alerts',
    tab_plugins: 'Plugins & Mods',
    tab_game_config: 'Game Config',
    tab_sidecars: 'DB-Sidecars',
    tab_security: 'JAR-Scanner & Schutz',
    tab_backups: 'Backups',
    tab_schedules: 'Zeitpläne',
    tab_databases: 'Datenbanken',
    tab_users: 'Sub-User',
    tab_audit: 'Audit-Trail',
    tab_settings: 'Einstellungen',

    // Dashboard & Metriken
    dash_cluster_operational: 'Cluster Betriebsbereit',
    dash_cluster_hub: 'Workloads & Cluster Hub',
    dash_cluster_desc: 'Echtzeit-Telemetrie, sekundenschnelle Container-Steuerung und verteilte Wings-Virtualisierung.',
    dash_deploy_instance: 'Instanz bereitstellen',
    dash_nodes_matrix: 'Nodes Matrix',
    dash_online_workloads: 'Aktive Workloads',
    dash_wings_daemons: 'Wings Daemons',
    dash_cluster_compute: 'Cluster Rechenleistung',
    dash_memory_allocation: 'Arbeitsspeicher (RAM)',
    dash_active: 'Aktiv',
    dash_offline: 'Offline',
    dash_mesh_health: '100% Netz-Integrität',
    dash_allocated_load: 'Auslastung',
    dash_capacity: 'Kapazität',
    dash_free: 'Frei',
    dash_filter_placeholder: 'Server oder Egg suchen...',
    dash_all: 'Alle',
    dash_running: 'Online',
    dash_starting: 'Startend',
    dash_stopped: 'Gestoppt',
    dash_power_actions: 'Power-Aktionen',
    dash_instance_egg: 'Instanz / Egg',
    dash_node_allocation: 'Node & IP-Port',
    dash_quick_power: 'Schnellsteuerung',

    // Power Actions
    power_start: 'Starten',
    power_restart: 'Neustarten',
    power_stop: 'Herunterfahren',
    power_kill: 'Sofort beenden (Kill)',

    // Live Chat Relay
    chat_relay_title: 'Live Chat Relay',
    chat_web_minecraft_sync: 'Web & Minecraft Live-Sync',
    chat_privacy_notice: 'Öffentlicher & nationaler Chat aktiv. Private MSGs (/msg, /tell, /w) werden ausgeblendet.',
    chat_send_as: 'Sende als:',
    chat_web_admin: 'Web Admin',
    chat_in_game: 'Im Spiel',
    chat_system: 'System',
    chat_type_placeholder: 'Öffentliche Nachricht an Server senden...',
    chat_announcement: '⚡ Ankündigung',

    // Settings & Theme
    settings_title: 'Benutzereinstellungen',
    settings_tab_profile: 'Profil',
    settings_tab_2fa: 'Zwei-Faktor (2FA)',
    settings_tab_api_keys: 'API-Schlüssel',
    settings_tab_themes: 'Design & Themes',
    settings_tab_backgrounds: 'Hintergrund-Effekte',
    settings_tab_custom_css: 'Eigenes CSS',
    theme_applied: 'Theme aktiviert',
    theme_desc: 'Wähle dein bevorzugtes Farbschema aus 11 handgefertigten Paletten.',
    bg_effect_title: 'Dynamische Hintergrund-Animationen',
    bg_effect_desc: 'Wähle den visuellen Effekt für deinen Panel-Hintergrund.',
    custom_css_title: 'Custom CSS Live Editor',
    custom_css_desc: 'Füge eigene CSS-Regeln ein. Änderungen werden sofort aktiv und lokal gespeichert.',
    custom_css_save: 'CSS anwenden & speichern',
    custom_css_clear: 'CSS zurücksetzen',
    language_title: 'Sprachauswahl',
    language_de: 'Deutsch (DE)',
    language_en: 'Englisch (EN)',

    // Common UI
    common_cancel: 'Abbrechen',
    common_save: 'Speichern',
    common_delete: 'Löschen',
    common_copied: 'Kopiert!',
    common_search: 'Suchen...',
    common_status: 'Status',
  },

  en: {
    // Navigation & Categories
    nav_dashboard: 'Dashboard',
    nav_workloads: 'Server Workloads',
    nav_nodes: 'Cluster Nodes',
    nav_users: 'Users & Roles',
    nav_audit: 'Audit Log',
    nav_nests: 'Nests & Eggs',
    nav_databases: 'Databases',
    nav_settings: 'Settings',
    nav_profile: 'My Profile',
    nav_logout: 'Sign Out',
    cat_operations_core: 'Operations & Core',
    cat_community_network: 'Community & Network',
    cat_services_extensions: 'Services & Extensions',
    cat_security_team: 'Security & Team',
    cat_platform: 'Platform',
    cat_administration: 'Administration',
    nav_all_servers: 'All Servers',
    nav_activity: 'Activity / Audit',
    nav_changelog: 'Changelog & Updates',
    admin_dashboard: 'Admin Dashboard',
    admin_servers: 'Servers',
    admin_nodes: 'Cluster Nodes',
    admin_users: 'Users',
    admin_eggs: 'Eggs & Nests',
    admin_databases: 'Databases',

    // Server Tabs
    tab_console: 'Console',
    tab_files: 'File Manager',
    tab_players: 'Players & Chat',
    tab_network: 'Network & Ports',
    tab_webhooks: 'Webhooks & Alerts',
    tab_plugins: 'Plugins & Mods',
    tab_game_config: 'Game Config',
    tab_sidecars: 'DB Sidecars',
    tab_security: 'JAR Scanner & Shield',
    tab_backups: 'Backups',
    tab_schedules: 'Schedules',
    tab_databases: 'Databases',
    tab_users: 'Sub-Users',
    tab_audit: 'Audit Trail',
    tab_settings: 'Settings',

    // Dashboard & Metrics
    dash_cluster_operational: 'Cluster Operational',
    dash_cluster_hub: 'Workloads & Cluster Hub',
    dash_cluster_desc: 'Real-time telemetry, instant container power orchestration, and distributed Wings virtualization matrix.',
    dash_deploy_instance: 'Deploy Instance',
    dash_nodes_matrix: 'Nodes Matrix',
    dash_online_workloads: 'Online Workloads',
    dash_wings_daemons: 'Wings Daemons',
    dash_cluster_compute: 'Cluster Compute',
    dash_memory_allocation: 'Memory Allocation',
    dash_active: 'Active',
    dash_offline: 'Offline',
    dash_mesh_health: '100% Mesh Health',
    dash_allocated_load: 'Load',
    dash_capacity: 'Capacity',
    dash_free: 'Free',
    dash_filter_placeholder: 'Filter instances or egg...',
    dash_all: 'All',
    dash_running: 'Running',
    dash_starting: 'Starting',
    dash_stopped: 'Stopped',
    dash_power_actions: 'Power Actions',
    dash_instance_egg: 'Instance / Egg',
    dash_node_allocation: 'Node & Port',
    dash_quick_power: 'Quick Power',

    // Power Actions
    power_start: 'Start',
    power_restart: 'Restart',
    power_stop: 'Stop',
    power_kill: 'Kill (SIGKILL)',

    // Live Chat Relay
    chat_relay_title: 'Live Chat Relay',
    chat_web_minecraft_sync: 'Web & Minecraft Live-Sync',
    chat_privacy_notice: 'Public & national chat active. Private whispers (/msg, /tell, /w) are strictly filtered out.',
    chat_send_as: 'Send as:',
    chat_web_admin: 'Web Admin',
    chat_in_game: 'In-Game',
    chat_system: 'System',
    chat_type_placeholder: 'Send public message to server...',
    chat_announcement: '⚡ Announcement',

    // Settings & Theme
    settings_title: 'Account Settings',
    settings_tab_profile: 'Profile',
    settings_tab_2fa: 'Two-Factor (2FA)',
    settings_tab_api_keys: 'API Keys',
    settings_tab_themes: 'Design & Themes',
    settings_tab_backgrounds: 'Background Effects',
    settings_tab_custom_css: 'Custom CSS',
    theme_applied: 'Theme Applied',
    theme_desc: 'Select your preferred accent theme from 11 curated handcrafted palettes.',
    bg_effect_title: 'Dynamic Background Effects',
    bg_effect_desc: 'Select the visual motion canvas for your panel background.',
    custom_css_title: 'Custom CSS Live Editor',
    custom_css_desc: 'Inject personal custom CSS stylesheet. Changes apply immediately and save locally.',
    custom_css_save: 'Apply & Save CSS',
    custom_css_clear: 'Reset Custom CSS',
    language_title: 'Language',
    language_de: 'German (DE)',
    language_en: 'English (EN)',

    // Common UI
    common_cancel: 'Cancel',
    common_save: 'Save Changes',
    common_delete: 'Delete',
    common_copied: 'Copied!',
    common_search: 'Search...',
    common_status: 'Status',
  },
};
