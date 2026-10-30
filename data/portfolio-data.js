/**
 * Mohamed Seddik Feki - Centralized Portfolio & ATS CV Data Core
 * Single Source of Truth (SSOT) driving both Interactive Web Portfolio & ATS CV.
 *
 * Universal Module Definition (UMD) pattern:
 * - Browser: window.PORTFOLIO_DATA
 * - Node.js: module.exports = PORTFOLIO_DATA
 * - TypeScript: typed via data/portfolio-data.d.ts
 */

(function (root, factory) {
  'use strict';

  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var data = factory();
    root.PORTFOLIO_DATA = data;
    if (typeof window !== 'undefined') {
      window.PORTFOLIO_DATA = data;
    }
    if (typeof globalThis !== 'undefined') {
      globalThis.PORTFOLIO_DATA = data;
    }
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var educationEntries = [
    {
      institution: "Xiamen University Malaysia (XMUM)",
      degree: "Bachelor of Robotics and Automation Engineering (Honours)",
      duration: "2025 – 2029",
      honors: "50% Academic Merit Scholarship",
      meritScholarship: "50% Merit Scholarship",
      status: "Undergraduate Engineering Student (Honours Program)",
      location: "Sepang, Selangor, Malaysia",
      focusAreas: [
        "Embedded Systems",
        "Autonomous Robotics",
        "Control Systems",
        "Computer Vision",
        "Full-Stack Software Engineering",
        "IoT Architecture"
      ],
      courseworkHighlights: [
        "Robot Operating System (ROS / ROS2)",
        "Embedded Microcontrollers & RTOS (ESP32 / ARM Cortex)",
        "Sensor Fusion & State Estimation (Extended Kalman Filters, IMU)",
        "Object-Oriented Software Design & Data Structures",
        "Computer Vision & Deep Learning Foundations",
        "Distributed IoT Telemetry Protocols & Cloud Integration"
      ]
    },
    {
      institution: "Lycée Pilote Hammam Lif",
      degree: "Tunisian National Baccalaureate (Mathematics Section – Highest Academic Track)",
      duration: "Graduated: 2024",
      honors: "Graduated with Honors (Score: 16.11/20)",
      meritScholarship: "Highest Academic Track (Mathematics)",
      status: "Alumnus with Honors",
      location: "Tunisia",
      focusAreas: [
        "Advanced Mathematics (National Grade: 19.75/20)",
        "Physics & Engineering Foundations",
        "Algorithmic Thinking & Scientific Computation"
      ],
      courseworkHighlights: [
        "Pure & Applied Mathematics (Algebra, Calculus, Analysis)",
        "Classical Mechanics & Electromagnetism",
        "Algorithmic Problem Solving"
      ]
    }
  ];

  // Dual access support: education as array and direct access to primary university entry
  educationEntries.institution = educationEntries[0].institution;
  educationEntries.degree = educationEntries[0].degree;
  educationEntries.duration = educationEntries[0].duration;
  educationEntries.honors = educationEntries[0].honors;
  educationEntries.meritScholarship = educationEntries[0].meritScholarship;
  educationEntries.status = educationEntries[0].status;
  educationEntries.location = educationEntries[0].location;
  educationEntries.focusAreas = educationEntries[0].focusAreas;
  educationEntries.courseworkHighlights = educationEntries[0].courseworkHighlights;

  var mobilityBadges = [
    {
      id: "my-onsite",
      label: "Malaysia On-Site & Hybrid",
      sublabel: "Available for on-site & hybrid engagements across Malaysia (Sepang, Cyberjaya, Kuala Lumpur)",
      icon: "map-pin",
      highlight: true
    },
    {
      id: "remote-global",
      label: "Remote Worldwide",
      sublabel: "Active for international freelance client projects & remote software/robotics internships",
      icon: "globe",
      highlight: true
    },
    {
      id: "summer-reloc",
      label: "Global Summer Relocation",
      sublabel: "Open to international relocation for Summer Internships (North America, Europe, Asia-Pacific)",
      icon: "plane",
      highlight: true
    }
  ];

  var skillsList = [
    {
      domainId: "web",
      categoryName: "Full-Stack Web & SaaS Development",
      skills: [
        "React",
        "Next.js",
        "TypeScript",
        "JavaScript (ES6+)",
        "HTML5",
        "CSS3",
        "Tailwind CSS",
        "Node.js",
        "REST & GraphQL APIs"
      ]
    },
    {
      domainId: "mobile",
      categoryName: "Mobile App Development",
      skills: [
        "Flutter",
        "React Native",
        "Dart",
        "Cross-Platform iOS/Android",
        "Mobile UI/UX Design",
        "State Management",
        "Offline Storage & Sync"
      ]
    },
    {
      domainId: "robotics",
      categoryName: "Robotics, Embedded & Automation",
      skills: [
        "C",
        "C++",
        "Python",
        "ROS / ROS2",
        "Arduino",
        "ESP32",
        "Microcontrollers",
        "Sensor Fusion",
        "IoT Protocols (MQTT/WebSockets)",
        "Control Algorithms"
      ]
    },
    {
      domainId: "cloud",
      categoryName: "Cloud, DevOps & Engineering Tools",
      skills: [
        "Firebase",
        "AWS",
        "Linux (Ubuntu/Debian)",
        "Git & GitHub",
        "Figma",
        "Docker Basics",
        "CI/CD Pipelines"
      ]
    }
  ];

  var projectsList = [
    {
      id: "cross-platform-mobile-app",
      title: "Cross-Platform Mobile App",
      fullTitle: "OmniTrack: Cross-Platform Fleet & Asset Telemetry App",
      category: "mobile",
      categoryLabel: "Mobile App",
      summary: "Production-ready cross-platform mobile application engineered with Flutter, Dart, and Firebase for real-time asset tracking and fleet dispatch. Implements offline-first cloud synchronization, reactive GPS maps, and push notifications.",
      techStack: [
        "Flutter",
        "Dart",
        "Firebase",
        "Firestore",
        "Google Maps SDK",
        "REST APIs",
        "iOS/Android"
      ],
      highlights: [
        "Engineered real-time telemetry streaming with sub-second latency across iOS & Android using reactive state management",
        "Architected offline-first local SQLite cache with automatic background synchronization upon network reconnection",
        "Designed clean, responsive mobile UX achieving 4.9/5 satisfaction in simulated user acceptance testing"
      ],
      metrics: "Sub-second sync | 100% offline-ready | iOS & Android",
      links: {
        github: "https://github.com/fekiseddik/omnitrack-mobile-flutter",
        demo: "projects/omnitrack-mobile/demo/index.html"
      },
      featured: true
    },
    {
      id: "fullstack-saas-platform",
      title: "Full-Stack SaaS Web Platform",
      fullTitle: "NexusPulse: Full-Stack Enterprise Analytics & SaaS Platform",
      category: "web",
      categoryLabel: "Full-Stack Web",
      summary: "High-performance SaaS web application built with Next.js, React, TypeScript, and Tailwind CSS. Features role-based access control, interactive data visualization, GraphQL and REST API endpoints, and dark/light mode.",
      techStack: [
        "Next.js",
        "TypeScript",
        "React",
        "Node.js",
        "Tailwind CSS",
        "GraphQL",
        "PostgreSQL"
      ],
      highlights: [
        "Engineered server-side rendered (SSR) dashboard delivering a 99/100 Lighthouse performance rating and sub-100ms API response times",
        "Built modular interactive data charts rendering 50,000+ time-series data points at smooth 60 FPS without DOM lag",
        "Secured end-to-end user authentication with JWT token rotation and granular role-based access control (RBAC)"
      ],
      metrics: "99 Lighthouse Score | 60 FPS charts | Zero layout shift",
      links: {
        github: "https://github.com/fekiseddik/nexus-pulse-saas",
        demo: "projects/nexus-pulse-saas/demo/index.html"
      },
      featured: true
    },
    {
      id: "ros-esp32-robotics-telemetry",
      title: "ROS/ESP32 Autonomous Robotics & Telemetry Dashboard",
      fullTitle: "RoboVision: ROS/ROS2 & ESP32 Autonomous Mobile Robot & Telemetry Dashboard",
      category: "robotics",
      categoryLabel: "Robotics & Embedded",
      summary: "Autonomous mobile robotic navigation system integrating ROS/ROS2, C++, Python, and dual-core ESP32 microcontrollers. Incorporates 2D LiDAR SLAM, obstacle avoidance algorithms, and a real-time browser telemetry dashboard.",
      techStack: [
        "ROS / ROS2",
        "C++",
        "ESP32",
        "Python",
        "WebSockets",
        "LiDAR SLAM",
        "Linux (Ubuntu)"
      ],
      highlights: [
        "Implemented real-time sensor fusion combining wheel odometry, IMU sensor data, and 2D planar LiDAR for centimeter-accurate SLAM localization",
        "Engineered custom C++ low-level motor driver firmware running on dual-core ESP32 with hardware PWM and hardware interrupt encoders",
        "Created a real-time WebSocket web telemetry dashboard streaming robot coordinates, LiDAR point clouds, and battery diagnostics"
      ],
      metrics: "±2cm positioning accuracy | Real-time SLAM | C++ RTOS",
      links: {
        github: "https://github.com/fekiseddik/ros2-esp32-amr",
        demo: "projects/robovision-ros2/demo/index.html"
      },
      featured: true
    },
    {
      id: "ai-iot-automation-system",
      title: "AI/Automation & IoT Control System",
      fullTitle: "SmartGrid: AI-Driven Industrial IoT & Environmental Automation Control System",
      category: "robotics",
      categoryLabel: "AI & Automation",
      summary: "Intelligent environmental monitoring and automated feedback control system powered by distributed ESP32 sensor nodes, MQTT messaging broker, Python edge inference, and cloud time-series logging.",
      techStack: [
        "Python",
        "MQTT",
        "Arduino",
        "ESP32",
        "Microcontrollers",
        "Sensor Fusion",
        "Node.js",
        "Control Algorithms"
      ],
      highlights: [
        "Formulated automated closed-loop PID control algorithms maintaining target environmental variables within ±1.5% of setpoints",
        "Deployed edge-based lightweight anomaly detection in Python to identify sensor drift and trigger fail-safe actuator cutoff",
        "Architected an ultra-low-power sleep schedule enabling battery-operated field sensor nodes to run 6+ months on a single charge"
      ],
      metrics: "±1.5% PID precision | MQTT broker | 6-month battery cycle",
      links: {
        github: "https://github.com/fekiseddik/smartgrid-iot-automation",
        demo: "projects/smartgrid-iot/demo/index.html"
      },
      featured: true
    }
  ];

  var PORTFOLIO_DATA = {
    personal: {
      name: "Mohamed Seddik Feki",
      headline: "Software, Web & Mobile App Developer | Robotics & Automation Engineering Undergrad",
      bioSummary: "Robotics and Automation Engineering honours student at Xiamen University Malaysia (2025–2029) on a 50% Academic Merit Scholarship, and versatile Full-Stack Software & Mobile Developer. Combining high-performance web and mobile app development (React, Next.js, Flutter, TypeScript) with embedded systems and autonomous robotics engineering (C++, Python, ROS2, ESP32). Equipped with 5-language multilingual fluency, exceptional mathematical problem-solving (19.75/20 Tunisian National Baccalaureate), 3-year leadership with the Red Crescent, and a proven freelance track record.",
      location: "Malaysia",
      contacts: {
        email: "fekiseddik@gmail.com",
        phone: "+60 14 273 5502",
        phoneRaw: "+60142735502",
        phoneSecondary: "+216 99 436 501",
        phoneSecondaryRaw: "+21699436501",
        whatsapp: "+216 99 436 501",
        whatsappUrl: "https://wa.me/60142735502?text=Hello%20Mohamed,%20I%20am%20contacting%20you%20regarding%20a%20project/internship%20opportunity.",
        whatsappUrlSecondary: "https://wa.me/21699436501?text=Hello%20Mohamed,%20I%20am%20contacting%20you%20regarding%20a%20project/internship%20opportunity.",
        github: "https://github.com/fekiseddik",
        githubUrl: "https://github.com/fekiseddik",
        linkedin: "https://www.linkedin.com/in/seddik-feki-01b084277/",
        linkedinUrl: "https://www.linkedin.com/in/seddik-feki-01b084277/",
        locationDisplay: "Sepang / Selangor / Kuala Lumpur, Malaysia"
      },
      mobilityBadges: mobilityBadges
    },

    mobility: mobilityBadges,

    education: educationEntries,

    baccalaureate: {
      qualification: "Tunisian National Baccalaureate",
      track: "Mathematics Section (Highest Academic Track in Tunisia)",
      honors: "Graduated with Honors: 16.11/20",
      mathScore: "19.75/20 (Elite National Tier)",
      school: "Lycée Pilote Hammam Lif",
      year: "2024"
    },

    skills: skillsList,
    technicalSkills: skillsList,

    languages: [
      {
        language: "Arabic",
        nativeName: "العربية",
        proficiency: "Native / Bilingual",
        levelTag: "Native",
        cert: "Native Fluency",
        notes: "Native language proficiency"
      },
      {
        language: "French",
        nativeName: "Français",
        proficiency: "Bilingual / Native Fluency",
        levelTag: "C1 Advanced",
        cert: "TCF French: C1 Level (Certified)",
        notes: "Official TCF certification & academic fluency"
      },
      {
        language: "English",
        nativeName: "English",
        proficiency: "Full Professional Working Proficiency",
        levelTag: "C1 Advanced",
        cert: "IELTS Academic: 7.5 (CEFR C1)",
        notes: "Medium of instruction at Xiamen University Malaysia"
      },
      {
        language: "Italian",
        nativeName: "Italiano",
        proficiency: "Working Proficiency",
        levelTag: "B2 Working Proficiency",
        cert: "Working Proficiency",
        notes: "High oral and written communicative capability"
      },
      {
        language: "Spanish",
        nativeName: "Español",
        proficiency: "Working Proficiency",
        levelTag: "B1+ Working Proficiency",
        cert: "Working Proficiency",
        notes: "Multilingual technical and conversational communication"
      }
    ],

    certifications: [
      {
        title: "IELTS Academic",
        issuer: "British Council / IDP",
        score: "7.5 Overall (CEFR C1 Advanced)",
        level: "CEFR C1",
        date: "2024",
        description: "Official academic English proficiency: Listening 8.0, Reading 8.0, Speaking 7.0, Writing 7.0"
      },
      {
        title: "Test de Connaissance du Français (TCF)",
        issuer: "France Éducation International",
        score: "C1 Level",
        level: "CEFR C1",
        date: "2024",
        description: "Official French language certification for higher education and professional engineering practice"
      },
      {
        title: "Professional Communication Skills",
        issuer: "International Training Center",
        score: "Certified",
        level: "Professional",
        date: "2023",
        description: "Advanced communication, technical pitching, and cross-cultural engineering teamwork certification"
      }
    ],

    projects: projectsList,
    showcaseProjects: projectsList,

    experience: [
      {
        role: "Freelance Software, Web & Mobile App Developer",
        organization: "Independent Contractor / Self-Employed",
        duration: "2023 – Present",
        location: "Remote Worldwide",
        summary: "Delivering bespoke, high-performance web platforms and cross-platform mobile applications for international startups, small businesses, and academic teams. Managing complete project lifecycles from architecture to production launch.",
        achievements: [
          "Architected and deployed 8+ commercial web and mobile solutions utilizing React, Next.js, Flutter, and Firebase with 100% on-time milestone delivery.",
          "Collaborated with international clients across Europe, Asia, and North America, translating business requirements into high-performance, maintainable code.",
          "Engineered resilient, scalable REST and GraphQL API services backed by PostgreSQL and Cloud Firestore with 99.9% operational uptime.",
          "Implemented responsive UI design systems with Figma and modern CSS/Tailwind, focusing on conversion rate optimization and accessibility."
        ],
        technologiesUsed: [
          "React",
          "Next.js",
          "TypeScript",
          "Flutter",
          "Dart",
          "Node.js",
          "Firebase",
          "Tailwind CSS",
          "REST & GraphQL APIs",
          "PostgreSQL"
        ]
      }
    ],

    community: [
      {
        organization: "Tunisian Red Crescent",
        role: "Core Planning Member & Active Volunteer",
        duration: "3 Years of Active Service",
        honors: "3-Time Awardee of 'Member of the Month' for leadership and crisis mobilization",
        achievements: [
          "Honored as 'Member of the Month' (3 Times) for outstanding operational reliability, crisis mobilization, and event planning.",
          "Organized humanitarian logistics and community health operations, coordinating cross-functional volunteer squads under high-pressure conditions.",
          "Led crisis response planning and volunteer management across regional initiatives in Tunisia."
        ]
      }
    ],

    services: [
      {
        id: "web-dev",
        title: "Full-Stack Web & SaaS Development",
        icon: "globe",
        description: "Custom, ultra-fast web applications, modern SaaS portals, and landing pages using React, Next.js, TypeScript, and modern CSS/Tailwind.",
        deliverables: [
          "Modern SaaS Dashboards & Portals",
          "Responsive High-Conversion Web Applications",
          "GraphQL & REST API Architecture",
          "Lighthouse 95+ Speed & SEO Optimization"
        ]
      },
      {
        id: "mobile-dev",
        title: "Cross-Platform Mobile App Development",
        icon: "smartphone",
        description: "Native-feel iOS and Android mobile applications developed with Flutter or React Native, backed by Firebase or custom cloud backends.",
        deliverables: [
          "Cross-Platform iOS & Android Builds",
          "Offline-First Data Storage & Cloud Sync",
          "Push Notifications & In-App Telemetry",
          "Fluid 60 FPS Mobile UI/UX Design"
        ]
      },
      {
        id: "robotics-iot",
        title: "Robotics, Embedded & IoT Prototyping",
        icon: "cpu",
        description: "Hardware-software integration, microcontroller firmware (ESP32/Arduino), ROS/ROS2 node development, and IoT telemetry dashboards.",
        deliverables: [
          "Optimized C/C++ Firmware (ESP32 / ARM / Arduino)",
          "ROS / ROS2 Nodes & SLAM Navigation",
          "Real-Time WebSockets & MQTT Telemetry",
          "Hardware Sensor Interfacing & State Estimation"
        ]
      },
      {
        id: "automation-ai",
        title: "Automation, Python Scripting & AI Solutions",
        icon: "zap",
        description: "Workflow automation, Python scripts, API integration pipelines, and technical consulting bridging software engineering and robotics.",
        deliverables: [
          "Python Task Automation & Scraping Pipelines",
          "Closed-Loop PID Control Systems",
          "Edge Computer Vision & Anomaly Detection",
          "System Architecture Advisory & Integration"
        ]
      }
    ],

    cvSettings: {
      atsSummary: "Robotics and Automation Engineering Honours student at Xiamen University Malaysia (2025–2029) on a 50% Academic Merit Scholarship, and versatile Full-Stack Software & Mobile Developer. Combining high-performance web and mobile app development (React, Next.js, Flutter, TypeScript) with embedded systems and autonomous robotics engineering (C++, Python, ROS2, ESP32). Equipped with 5-language multilingual fluency, exceptional mathematical foundations (19.75/20 Tunisian National Baccalaureate), and proven freelance track record.",
      targetRoles: [
        "Software Engineering Intern (Summer 2026 / 2027)",
        "Robotics & Autonomous Systems Engineering Intern",
        "Full-Stack Web & Mobile App Developer (Freelance / Remote)"
      ],
      showContactIconsOnPrint: false
    }
  };

  return PORTFOLIO_DATA;
}));
