// ============================================================
//  EDIT THIS FILE TO ADD / REMOVE / UPDATE DASHBOARDS
//  Works when opened directly as a file:// OR served from a web server.
// ============================================================

window.PLH_DATA = {
  site: {
    name:     "PLH Dashboard",
    subtitle: "",
    tagline:  "Access real-time monitoring and evaluation data across all PLH programmes and country adaptations."
  },
  dashboards: [
    {
      name:    "Global Reach",
      desc:    "Aggregate reach across all PLH country adaptations and programme types.",
      url:     "https://plhdashboard.org/reach",
      icon:    "globe",
      tag:     "Global",
      // appType: "ParentText",
      accent:  "gold"
    },
    {
      name:    "ParentText Global",
      desc:    "Aggregated ParentText usage and reach across all global deployments.",
      url:     "https://plhdashboard.org/core",
      icon:    "message-circle",
      tag:     "Global",
      appType: "ParentText",
      accent:  "gold"
    },
    {
      name:    "Parenting in Crisis - Global",
      desc:    "Global crisis support metrics aggregated across all ParentText crisis contexts.",
      url:     "https://plhdashboard.org/crisis",
      icon:    "life-buoy",
      tag:     "Crisis",
      appType: "ParentText",
      accent:  "red"
    },
    {
      name:    "Malaysia (Kemas/MASW)",
      desc:    "Monitoring data for the Malaysian Kemas and MASW programme adaptations.",
      url:     "https://plhdashboard.org/malaysia",
      icon:    "map",
      tag:     "Programme",
      appType: "ParentText|Facilitator App",
      accent:  "gold"
    },
    {
      name:    "Parenting in Crisis - World Vision",
      desc:    "Crisis support metrics for the World Vision ParentText deployment.",
      url:     "https://plhdashboard.org/wvi",
      icon:    "shield",
      tag:     "Crisis",
      appType: "ParentText",
      accent:  "red"
    },
    {
      name:    "Crianza Con Conciencia+",
      desc:    "Programme reach and session data for Crianza Con Conciencia+ cohorts.",
      url:     "https://plhdashboard.org/mexico",
      icon:    "book-open",
      tag:     "Programme",
      appType: "ParentText|Facilitator App",
      accent:  "sky"
    },
    {
      name:    "Crianza Con Conciencia+ (es)",
      desc:    "Spanish-language view of Crianza Con Conciencia+ programme data.",
      url:     "https://plhdashboard.org/mexico-es",
      icon:    "languages",
      tag:     "Programme",
      appType: "ParentText|Facilitator App",
      accent:  "sky"
    },
    {
      name:    "ParentApp - South Africa",
      desc:    "User engagement and retention for the South Africa ParentApp deployment.",
      url:     "https://plhdashboard.org/sapa",
      icon:    "smartphone",
      tag:     "Programme",
      appType: "ParentApp",
      accent:  "sky"
    },
    {
      name:    "ParentApp - Kuwait",
      desc:    "User engagement and retention for the Kuwait ParentApp deployment.",
      url:     "https://plhdashboard.org/kuwait",
      icon:    "tablet",
      tag:     "Programme",
      appType: "ParentApp",
      accent:  "sky"
    },
    {
      name:    "SWIFT RCT - South Africa",
      desc:    "Randomised controlled trial outcomes and follow-up data for SWIFT.",
      url:     "https://plhdashboard.org/swiftrct",
      icon:    "clipboard-list",
      tag:     "Programme",
      appType: "ParentText",
      accent:  "red"
    },
    {
      name:    "5DAY UX RCT - South Africa",
      desc:    "RCT monitoring, enrolment, and outcome data for the 5-Day UX trial.",
      url:     "https://plhdashboard.org/sarct",
      icon:    "bar-chart-2",
      tag:     "Programme",
      appType: "ParentText",
      accent:  "red"
    },
    {
      name:    "Parenting in Crisis - Palestine",
      desc:    "Crisis support reach and engagement metrics for Palestine.",
      url:     "https://plhdashboard.org/palestine",
      icon:    "phone-call",
      tag:     "Crisis",
      appType: "ParentText",
      accent:  "red"
    },
    // {
    //   name:    "ParentApp - Global",
    //   desc:    "User engagement and reach across all global ParentApp deployments.",
    //   url:     "https://plhdashboard.org/parentapp",
    //   icon:    "globe",
    //   tag:     "Global",
    //   appType: "ParentApp",
    //   accent:  "gold"
    // },
    {
      name:    "ParentApp - Malaysia (NK)",
      desc:    "User engagement and retention for the NK Malaysia ParentApp deployment.",
      url:     "https://plhdashboard.org/nkapp",
      icon:    "tablet",
      tag:     "Programme",
      appType: "ParentApp",
      accent:  "sky"
    },
    {
      name:    "ParentApp - Tanzania",
      desc:    "User engagement and retention for the Tanzania ParentApp deployment.",
      url:     "https://plhdashboard.org/tanzania",
      icon:    "smartphone",
      tag:     "Programme",
      appType: "ParentApp",
      accent:  "sky"
    },
    {
      name:    "SWIFT - South Africa",
      desc:    "Programme monitoring and delivery data for SWIFT South Africa.",
      url:     "https://plhdashboard.org/swift",
      icon:    "activity",
      tag:     "Programme",
      appType: "ParentText",
      accent:  "sky"
    },
    {
      name:    "Facilitator App - Philippines",
      desc:    "Facilitator activity and session completion for the Philippines deployment.",
      url:     "https://plhdashboard.org/philippines",
      icon:    "presentation",
      tag:     "Programme",
      appType: "Facilitator App",
      accent:  "gold"
    },
    // {
    //   name:    "ParentApp - Malaysia (NK)",
    //   desc:    "User engagement and retention for the NK Malaysia ParentApp deployment.",
    //   url:     "https://plhdashboard.org/nkapp",
    //   icon:    "tablet",
    //   tag:     "Programme",
    //   appType: "ParentApp",
    //   accent:  "sky"
    // },
    {
      name:    "Facilitator App - Curaçao",
      desc:    "Facilitator activity and session completion for the Curaçao deployment.",
      url:     "https://plhdashboard.org/curacao",
      icon:    "users",
      tag:     "Programme",
      appType: "Facilitator App",
      accent:  "gold"
    }
  ]
};
