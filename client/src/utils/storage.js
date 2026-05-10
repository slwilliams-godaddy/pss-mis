const KEYS = {
  config:   'pss-mis:config',
  team:     'pss-mis:team',
  archive:  'pss-mis:archive',
  password: 'pss-mis:password',
}

const DEFAULT_PASSWORD = 'changeme'

const DEFAULT_CONFIG = {
  month: '2026-05',
  cpd: { min: 14, target: 17, max: 20 },
  gcr: { min: 40, target: 70, max: 100 },
  qa:  { min: 70, target: 85, max: 100 },
}

const DEFAULT_TEAM = {
  month: '2026-05',
  guides: [{ name: '', cpdMode: 'perday', cpd: '', gcrMode: 'perday', gcr: '', qa: '', days: '' }],
}

// Jan–Apr 2026 seed data
const DEFAULT_ARCHIVE = {
  "2026-01": {
    "month": "2026-01",
    "closedAt": "2026-01-28T17:00:00.000Z",
    "config": { "month": "2026-01", "cpd": { "min": 13, "target": 15, "max": 18 }, "gcr": { "min": 35, "target": 60, "max": 90 }, "qa": { "min": 68, "target": 83, "max": 100 } },
    "guides": [
      { "name": "Alex Chen",      "cpdMode": "perday", "cpd": "18.2", "gcrMode": "perday", "gcr": "88",  "qa": "94", "days": "21" },
      { "name": "Jordan Smith",   "cpdMode": "perday", "cpd": "16.8", "gcrMode": "perday", "gcr": "75",  "qa": "88", "days": "21" },
      { "name": "Maya Rodriguez", "cpdMode": "perday", "cpd": "15.5", "gcrMode": "perday", "gcr": "65",  "qa": "85", "days": "21" },
      { "name": "Tyler Johnson",  "cpdMode": "perday", "cpd": "14.2", "gcrMode": "perday", "gcr": "58",  "qa": "82", "days": "21" },
      { "name": "Sam Williams",   "cpdMode": "perday", "cpd": "17.9", "gcrMode": "perday", "gcr": "85",  "qa": "92", "days": "21" },
      { "name": "Casey Brown",    "cpdMode": "perday", "cpd": "12.5", "gcrMode": "perday", "gcr": "45",  "qa": "75", "days": "21" },
      { "name": "Morgan Davis",   "cpdMode": "perday", "cpd": "16.2", "gcrMode": "perday", "gcr": "70",  "qa": "86", "days": "21" },
      { "name": "Riley Wilson",   "cpdMode": "perday", "cpd": "11.0", "gcrMode": "perday", "gcr": "38",  "qa": "70", "days": "21" },
      { "name": "Drew Martinez",  "cpdMode": "perday", "cpd": "15.0", "gcrMode": "perday", "gcr": "63",  "qa": "84", "days": "21" },
      { "name": "Avery Thompson", "cpdMode": "perday", "cpd": "18.8", "gcrMode": "perday", "gcr": "92",  "qa": "95", "days": "21" },
      { "name": "Quinn Anderson", "cpdMode": "perday", "cpd": "13.8", "gcrMode": "perday", "gcr": "52",  "qa": "79", "days": "21" },
      { "name": "Blake Nelson",   "cpdMode": "perday", "cpd": "16.5", "gcrMode": "perday", "gcr": "73",  "qa": "88", "days": "21" }
    ],
    "results": [
      { "name": "Alex Chen",      "actuals": { "cpd": 18.2, "gcr": 88, "qa": 94 }, "cpd": 35,     "gcr": 18.67, "qa": 12.94, "total": 66.61,  "passing": true  },
      { "name": "Jordan Smith",   "actuals": { "cpd": 16.8, "gcr": 75, "qa": 88 }, "cpd": 30,     "gcr": 10,    "qa": 8.24,  "total": 48.24,  "passing": true  },
      { "name": "Maya Rodriguez", "actuals": { "cpd": 15.5, "gcr": 65, "qa": 85 }, "cpd": 17.5,   "gcr": 1.67,  "qa": 2.35,  "total": 21.52,  "passing": true  },
      { "name": "Tyler Johnson",  "actuals": { "cpd": 14.2, "gcr": 58, "qa": 82 }, "cpd": 2.8,    "gcr": -6.67, "qa": -0.59, "total": -4.46,  "passing": false },
      { "name": "Sam Williams",   "actuals": { "cpd": 17.9, "gcr": 85, "qa": 92 }, "cpd": 33.5,   "gcr": 16.67, "qa": 10.59, "total": 60.76,  "passing": true  },
      { "name": "Casey Brown",    "actuals": { "cpd": 12.5, "gcr": 45, "qa": 75 }, "cpd": -12.5,  "gcr": -12,   "qa": -10.59,"total": -35.09, "passing": false },
      { "name": "Morgan Davis",   "actuals": { "cpd": 16.2, "gcr": 70, "qa": 86 }, "cpd": 24,     "gcr": 6.67,  "qa": 3.53,  "total": 34.2,   "passing": true  },
      { "name": "Riley Wilson",   "actuals": { "cpd": 11.0, "gcr": 38, "qa": 70 }, "cpd": -20,    "gcr": -17.33,"qa": -20,   "total": -57.33, "passing": false },
      { "name": "Drew Martinez",  "actuals": { "cpd": 15.0, "gcr": 63, "qa": 84 }, "cpd": 14,     "gcr": 0,     "qa": 1.18,  "total": 15.18,  "passing": true  },
      { "name": "Avery Thompson", "actuals": { "cpd": 18.8, "gcr": 92, "qa": 95 }, "cpd": 35,     "gcr": 20,    "qa": 14.12, "total": 69.12,  "passing": true  },
      { "name": "Quinn Anderson", "actuals": { "cpd": 13.8, "gcr": 52, "qa": 79 }, "cpd": -2.8,   "gcr": -10.67,"qa": -4.71, "total": -18.18, "passing": false },
      { "name": "Blake Nelson",   "actuals": { "cpd": 16.5, "gcr": 73, "qa": 88 }, "cpd": 27.5,   "gcr": 8.67,  "qa": 8.24,  "total": 44.41,  "passing": true  }
    ],
    "averages": { "cpd": 15.87, "gcr": 67, "qa": 84.83, "cpdPts": 15.25, "gcrPts": 3.03, "qaPts": 2.11, "total": 20.38, "passRate": 0.67, "count": 12 }
  },
  "2026-02": {
    "month": "2026-02",
    "closedAt": "2026-02-28T17:00:00.000Z",
    "config": { "month": "2026-02", "cpd": { "min": 13, "target": 16, "max": 19 }, "gcr": { "min": 38, "target": 65, "max": 95 }, "qa": { "min": 70, "target": 84, "max": 100 } },
    "guides": [
      { "name": "Alex Chen",      "cpdMode": "perday", "cpd": "19.1", "gcrMode": "perday", "gcr": "90",  "qa": "95", "days": "21" },
      { "name": "Jordan Smith",   "cpdMode": "perday", "cpd": "17.2", "gcrMode": "perday", "gcr": "78",  "qa": "89", "days": "21" },
      { "name": "Maya Rodriguez", "cpdMode": "perday", "cpd": "16.0", "gcrMode": "perday", "gcr": "68",  "qa": "86", "days": "21" },
      { "name": "Tyler Johnson",  "cpdMode": "perday", "cpd": "13.8", "gcrMode": "perday", "gcr": "55",  "qa": "80", "days": "21" },
      { "name": "Sam Williams",   "cpdMode": "perday", "cpd": "17.5", "gcrMode": "perday", "gcr": "83",  "qa": "91", "days": "21" },
      { "name": "Casey Brown",    "cpdMode": "perday", "cpd": "13.0", "gcrMode": "perday", "gcr": "48",  "qa": "76", "days": "21" },
      { "name": "Morgan Davis",   "cpdMode": "perday", "cpd": "15.8", "gcrMode": "perday", "gcr": "68",  "qa": "85", "days": "21" },
      { "name": "Riley Wilson",   "cpdMode": "perday", "cpd": "11.5", "gcrMode": "perday", "gcr": "42",  "qa": "72", "days": "21" },
      { "name": "Drew Martinez",  "cpdMode": "perday", "cpd": "15.5", "gcrMode": "perday", "gcr": "66",  "qa": "85", "days": "21" },
      { "name": "Avery Thompson", "cpdMode": "perday", "cpd": "19.2", "gcrMode": "perday", "gcr": "94",  "qa": "96", "days": "21" },
      { "name": "Quinn Anderson", "cpdMode": "perday", "cpd": "14.2", "gcrMode": "perday", "gcr": "55",  "qa": "80", "days": "21" },
      { "name": "Blake Nelson",   "cpdMode": "perday", "cpd": "16.2", "gcrMode": "perday", "gcr": "71",  "qa": "87", "days": "21" }
    ],
    "results": [
      { "name": "Alex Chen",      "actuals": { "cpd": 19.1, "gcr": 90, "qa": 95 }, "cpd": 35,     "gcr": 16.67, "qa": 13.75, "total": 65.42,  "passing": true  },
      { "name": "Jordan Smith",   "actuals": { "cpd": 17.2, "gcr": 78, "qa": 89 }, "cpd": 17,     "gcr": 8.67,  "qa": 6.25,  "total": 31.92,  "passing": true  },
      { "name": "Maya Rodriguez", "actuals": { "cpd": 16.0, "gcr": 68, "qa": 86 }, "cpd": 8,      "gcr": 2,     "qa": 2.5,   "total": 12.5,   "passing": true  },
      { "name": "Tyler Johnson",  "actuals": { "cpd": 13.8, "gcr": 55, "qa": 80 }, "cpd": -7,     "gcr": -6.67, "qa": -5,    "total": -18.67, "passing": false },
      { "name": "Sam Williams",   "actuals": { "cpd": 17.5, "gcr": 83, "qa": 91 }, "cpd": 20,     "gcr": 12,    "qa": 8.75,  "total": 40.75,  "passing": true  },
      { "name": "Casey Brown",    "actuals": { "cpd": 13.0, "gcr": 48, "qa": 76 }, "cpd": -10,    "gcr": -11.33,"qa": -10,   "total": -31.33, "passing": false },
      { "name": "Morgan Davis",   "actuals": { "cpd": 15.8, "gcr": 68, "qa": 85 }, "cpd": -0.67,  "gcr": 2,     "qa": 0.63,  "total": 1.96,   "passing": true  },
      { "name": "Riley Wilson",   "actuals": { "cpd": 11.5, "gcr": 42, "qa": 72 }, "cpd": -15,    "gcr": -15.33,"qa": -15,   "total": -45.33, "passing": false },
      { "name": "Drew Martinez",  "actuals": { "cpd": 15.5, "gcr": 66, "qa": 85 }, "cpd": -1.67,  "gcr": 0.67,  "qa": 0.63,  "total": -0.37,  "passing": false },
      { "name": "Avery Thompson", "actuals": { "cpd": 19.2, "gcr": 94, "qa": 96 }, "cpd": 35,     "gcr": 19.33, "qa": 15,    "total": 69.33,  "passing": true  },
      { "name": "Quinn Anderson", "actuals": { "cpd": 14.2, "gcr": 55, "qa": 80 }, "cpd": -6,     "gcr": -6.67, "qa": -5,    "total": -17.67, "passing": false },
      { "name": "Blake Nelson",   "actuals": { "cpd": 16.2, "gcr": 71, "qa": 87 }, "cpd": 1.33,   "gcr": 4,     "qa": 3.75,  "total": 9.08,   "passing": true  }
    ],
    "averages": { "cpd": 15.75, "gcr": 68.5, "qa": 85.17, "cpdPts": 6.42, "gcrPts": 2.11, "qaPts": 1.27, "total": 9.8, "passRate": 0.58, "count": 12 }
  },
  "2026-03": {
    "month": "2026-03",
    "closedAt": "2026-03-28T17:00:00.000Z",
    "config": { "month": "2026-03", "cpd": { "min": 14, "target": 16, "max": 19 }, "gcr": { "min": 40, "target": 67, "max": 100 }, "qa": { "min": 70, "target": 84, "max": 100 } },
    "guides": [
      { "name": "Alex Chen",      "cpdMode": "perday", "cpd": "18.8", "gcrMode": "perday", "gcr": "92",  "qa": "93", "days": "21" },
      { "name": "Jordan Smith",   "cpdMode": "perday", "cpd": "17.5", "gcrMode": "perday", "gcr": "80",  "qa": "90", "days": "21" },
      { "name": "Maya Rodriguez", "cpdMode": "perday", "cpd": "16.8", "gcrMode": "perday", "gcr": "72",  "qa": "87", "days": "21" },
      { "name": "Tyler Johnson",  "cpdMode": "perday", "cpd": "15.0", "gcrMode": "perday", "gcr": "62",  "qa": "83", "days": "21" },
      { "name": "Sam Williams",   "cpdMode": "perday", "cpd": "18.2", "gcrMode": "perday", "gcr": "87",  "qa": "93", "days": "21" },
      { "name": "Casey Brown",    "cpdMode": "perday", "cpd": "12.8", "gcrMode": "perday", "gcr": "50",  "qa": "78", "days": "21" },
      { "name": "Morgan Davis",   "cpdMode": "perday", "cpd": "16.5", "gcrMode": "perday", "gcr": "72",  "qa": "87", "days": "21" },
      { "name": "Riley Wilson",   "cpdMode": "perday", "cpd": "12.2", "gcrMode": "perday", "gcr": "44",  "qa": "73", "days": "21" },
      { "name": "Drew Martinez",  "cpdMode": "perday", "cpd": "16.0", "gcrMode": "perday", "gcr": "69",  "qa": "86", "days": "21" },
      { "name": "Avery Thompson", "cpdMode": "perday", "cpd": "19.5", "gcrMode": "perday", "gcr": "96",  "qa": "97", "days": "21" },
      { "name": "Quinn Anderson", "cpdMode": "perday", "cpd": "14.0", "gcrMode": "perday", "gcr": "53",  "qa": "79", "days": "21" },
      { "name": "Blake Nelson",   "cpdMode": "perday", "cpd": "17.0", "gcrMode": "perday", "gcr": "76",  "qa": "89", "days": "21" }
    ],
    "results": [
      { "name": "Alex Chen",      "actuals": { "cpd": 18.8, "gcr": 92, "qa": 93 }, "cpd": 35,     "gcr": 15.15, "qa": 11.25, "total": 61.4,   "passing": true  },
      { "name": "Jordan Smith",   "actuals": { "cpd": 17.5, "gcr": 80, "qa": 90 }, "cpd": 25,     "gcr": 3.94,  "qa": 7.5,   "total": 36.44,  "passing": true  },
      { "name": "Maya Rodriguez", "actuals": { "cpd": 16.8, "gcr": 72, "qa": 87 }, "cpd": 16,     "gcr": 1.52,  "qa": 3.75,  "total": 21.27,  "passing": true  },
      { "name": "Tyler Johnson",  "actuals": { "cpd": 15.0, "gcr": 62, "qa": 83 }, "cpd": -3.33,  "gcr": -1.85, "qa": -0.63, "total": -5.81,  "passing": false },
      { "name": "Sam Williams",   "actuals": { "cpd": 18.2, "gcr": 87, "qa": 93 }, "cpd": 29,     "gcr": 9.09,  "qa": 11.25, "total": 49.34,  "passing": true  },
      { "name": "Casey Brown",    "actuals": { "cpd": 12.8, "gcr": 50, "qa": 78 }, "cpd": -15.56, "gcr": -6.33, "qa": -7.5,  "total": -29.39, "passing": false },
      { "name": "Morgan Davis",   "actuals": { "cpd": 16.5, "gcr": 72, "qa": 87 }, "cpd": 11,     "gcr": 1.52,  "qa": 3.75,  "total": 16.27,  "passing": true  },
      { "name": "Riley Wilson",   "actuals": { "cpd": 12.2, "gcr": 44, "qa": 73 }, "cpd": -19.44, "gcr": -8.52, "qa": -13.75,"total": -41.71, "passing": false },
      { "name": "Drew Martinez",  "actuals": { "cpd": 16.0, "gcr": 69, "qa": 86 }, "cpd": 8,      "gcr": 0.61,  "qa": 2.5,   "total": 11.11,  "passing": true  },
      { "name": "Avery Thompson", "actuals": { "cpd": 19.5, "gcr": 96, "qa": 97 }, "cpd": 35,     "gcr": 17.58, "qa": 16.25, "total": 68.83,  "passing": true  },
      { "name": "Quinn Anderson", "actuals": { "cpd": 14.0, "gcr": 53, "qa": 79 }, "cpd": -5.56,  "gcr": -5.15, "qa": -6.25, "total": -16.96, "passing": false },
      { "name": "Blake Nelson",   "actuals": { "cpd": 17.0, "gcr": 76, "qa": 89 }, "cpd": 18,     "gcr": 2.73,  "qa": 6.25,  "total": 26.98,  "passing": true  }
    ],
    "averages": { "cpd": 16.28, "gcr": 71.08, "qa": 86.33, "cpdPts": 11.09, "gcrPts": 2.52, "qaPts": 3.01, "total": 16.65, "passRate": 0.67, "count": 12 }
  },
  "2026-04": {
    "month": "2026-04",
    "closedAt": "2026-04-28T17:00:00.000Z",
    "config": { "month": "2026-04", "cpd": { "min": 14, "target": 17, "max": 20 }, "gcr": { "min": 40, "target": 70, "max": 100 }, "qa": { "min": 70, "target": 85, "max": 100 } },
    "guides": [
      { "name": "Alex Chen",      "cpdMode": "perday", "cpd": "19.5", "gcrMode": "perday", "gcr": "95",  "qa": "96", "days": "21" },
      { "name": "Jordan Smith",   "cpdMode": "perday", "cpd": "18.0", "gcrMode": "perday", "gcr": "82",  "qa": "91", "days": "21" },
      { "name": "Maya Rodriguez", "cpdMode": "perday", "cpd": "17.2", "gcrMode": "perday", "gcr": "75",  "qa": "88", "days": "21" },
      { "name": "Tyler Johnson",  "cpdMode": "perday", "cpd": "15.5", "gcrMode": "perday", "gcr": "65",  "qa": "84", "days": "21" },
      { "name": "Sam Williams",   "cpdMode": "perday", "cpd": "17.8", "gcrMode": "perday", "gcr": "86",  "qa": "92", "days": "21" },
      { "name": "Casey Brown",    "cpdMode": "perday", "cpd": "13.5", "gcrMode": "perday", "gcr": "52",  "qa": "77", "days": "21" },
      { "name": "Morgan Davis",   "cpdMode": "perday", "cpd": "16.0", "gcrMode": "perday", "gcr": "71",  "qa": "86", "days": "21" },
      { "name": "Riley Wilson",   "cpdMode": "perday", "cpd": "12.8", "gcrMode": "perday", "gcr": "46",  "qa": "74", "days": "21" },
      { "name": "Drew Martinez",  "cpdMode": "perday", "cpd": "16.5", "gcrMode": "perday", "gcr": "72",  "qa": "87", "days": "21" },
      { "name": "Avery Thompson", "cpdMode": "perday", "cpd": "20.0", "gcrMode": "perday", "gcr": "99",  "qa": "98", "days": "21" },
      { "name": "Quinn Anderson", "cpdMode": "perday", "cpd": "14.5", "gcrMode": "perday", "gcr": "58",  "qa": "81", "days": "21" },
      { "name": "Blake Nelson",   "cpdMode": "perday", "cpd": "17.5", "gcrMode": "perday", "gcr": "79",  "qa": "90", "days": "21" }
    ],
    "results": [
      { "name": "Alex Chen",      "actuals": { "cpd": 19.5, "gcr": 95, "qa": 96 }, "cpd": 29.17,  "gcr": 16.67, "qa": 14.67, "total": 60.5,   "passing": true  },
      { "name": "Jordan Smith",   "actuals": { "cpd": 18.0, "gcr": 82, "qa": 91 }, "cpd": 11.67,  "gcr": 8,     "qa": 8,     "total": 27.67,  "passing": true  },
      { "name": "Maya Rodriguez", "actuals": { "cpd": 17.2, "gcr": 75, "qa": 88 }, "cpd": 2.33,   "gcr": 3.33,  "qa": 4,     "total": 9.67,   "passing": true  },
      { "name": "Tyler Johnson",  "actuals": { "cpd": 15.5, "gcr": 65, "qa": 84 }, "cpd": -16.67, "gcr": -3.33, "qa": -0.67, "total": -20.67, "passing": false },
      { "name": "Sam Williams",   "actuals": { "cpd": 17.8, "gcr": 86, "qa": 92 }, "cpd": 9.33,   "gcr": 10.67, "qa": 9.33,  "total": 29.33,  "passing": true  },
      { "name": "Casey Brown",    "actuals": { "cpd": 13.5, "gcr": 52, "qa": 77 }, "cpd": -35,    "gcr": -12,   "qa": -10.67,"total": -57.67, "passing": false },
      { "name": "Morgan Davis",   "actuals": { "cpd": 16.0, "gcr": 71, "qa": 86 }, "cpd": -3.33,  "gcr": 0.67,  "qa": 0.67,  "total": -2,     "passing": false },
      { "name": "Riley Wilson",   "actuals": { "cpd": 12.8, "gcr": 46, "qa": 74 }, "cpd": -35,    "gcr": -16,   "qa": -14.67,"total": -65.67, "passing": false },
      { "name": "Drew Martinez",  "actuals": { "cpd": 16.5, "gcr": 72, "qa": 87 }, "cpd": -1.67,  "gcr": 1.33,  "qa": 2.67,  "total": 2.33,   "passing": true  },
      { "name": "Avery Thompson", "actuals": { "cpd": 20.0, "gcr": 99, "qa": 98 }, "cpd": 35,     "gcr": 19.33, "qa": 17.33, "total": 71.67,  "passing": true  },
      { "name": "Quinn Anderson", "actuals": { "cpd": 14.5, "gcr": 58, "qa": 81 }, "cpd": -20,    "gcr": -8,    "qa": -5.33, "total": -33.33, "passing": false },
      { "name": "Blake Nelson",   "actuals": { "cpd": 17.5, "gcr": 79, "qa": 90 }, "cpd": 5.83,   "gcr": 6,     "qa": 6.67,  "total": 18.5,   "passing": true  }
    ],
    "averages": { "cpd": 16.61, "gcr": 73.33, "qa": 87, "cpdPts": -1.53, "gcrPts": 2.22, "qaPts": 2.67, "total": 3.36, "passRate": 0.5, "count": 12 }
  }
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function computeAverages(results) {
  const valid = (results || []).filter(Boolean)
  if (!valid.length) return null
  const avg = arr => Math.round(arr.reduce((s, v) => s + v, 0) / arr.length * 100) / 100
  return {
    cpd:      avg(valid.map(r => r.actuals.cpd)),
    gcr:      avg(valid.map(r => r.actuals.gcr)),
    qa:       avg(valid.map(r => r.actuals.qa)),
    cpdPts:   avg(valid.map(r => r.cpd)),
    gcrPts:   avg(valid.map(r => r.gcr)),
    qaPts:    avg(valid.map(r => r.qa)),
    total:    avg(valid.map(r => r.total)),
    passRate: Math.round(valid.filter(r => r.passing).length / valid.length * 100) / 100,
    count:    valid.length,
  }
}

export function getConfig() {
  return read(KEYS.config, DEFAULT_CONFIG)
}

export function saveConfig(config) {
  write(KEYS.config, config)
  return config
}

export function getTeam() {
  return read(KEYS.team, DEFAULT_TEAM)
}

export function saveTeam(month, guides) {
  const data = { month, guides }
  write(KEYS.team, data)
  return data
}

export function closeMonth(results, config) {
  const team = getTeam()
  if (!team.month) throw new Error('No active month to close')

  const archive = read(KEYS.archive, DEFAULT_ARCHIVE)
  archive[team.month] = {
    month: team.month,
    closedAt: new Date().toISOString(),
    config,
    guides: team.guides,
    results: results || [],
    averages: computeAverages(results),
  }
  write(KEYS.archive, archive)

  const reset = {
    month: team.month,
    guides: team.guides.map(g => ({
      name: g.name,
      cpdMode: 'perday', cpd: '',
      gcrMode: 'perday', gcr: '',
      qa: '', days: '',
    })),
  }
  write(KEYS.team, reset)
  return { archived: team.month, current: reset }
}

export function getArchivedMonths() {
  const archive = read(KEYS.archive, DEFAULT_ARCHIVE)
  return Object.keys(archive).sort().reverse()
}

export function getArchivedMonth(month) {
  const archive = read(KEYS.archive, DEFAULT_ARCHIVE)
  return archive[month] || null
}

export function upsertArchivedMonth(month, { guides, results, config }) {
  const archive = read(KEYS.archive, DEFAULT_ARCHIVE)
  const existing = archive[month] || {}
  archive[month] = {
    ...existing,
    month,
    guides: guides || existing.guides || [],
    results: results || [],
    averages: computeAverages(results),
    config: config || existing.config,
    updatedAt: new Date().toISOString(),
    closedAt: existing.closedAt || new Date().toISOString(),
  }
  write(KEYS.archive, archive)
  return archive[month]
}

export function checkPassword(password) {
  const stored = read(KEYS.password, DEFAULT_PASSWORD)
  return password === stored
}
