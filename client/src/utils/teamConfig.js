export const TEAM_DEFS = {
  pss: {
    label: 'PSS',
    fullName: 'Powerseller Success',
    metricDefs: [
      {
        key: 'cpd', label: 'CPD', fullName: 'Contributions Per Day',
        prefix: '', suffix: '/day', weight: 1.5, rail: { min: -35, max: 35 },
        entryMode: 'perday', channelSplit: true,
        configKey: 'cpd', configKeyVoice: null, configKeyMessaging: null,
        tamTargets: false, tamTargetMap: null, isQuality: false, maxEntry: null,
      },
      {
        key: 'gcr', label: 'GCR', fullName: 'Gross Cash Revenue Per Day',
        prefix: '$', suffix: '/day', weight: 1.0, rail: { min: -20, max: 20 },
        entryMode: 'perday', channelSplit: true,
        configKey: 'gcr', configKeyVoice: 'gcrVoice', configKeyMessaging: 'gcrMessaging',
        tamTargets: false, tamTargetMap: null, isQuality: false, maxEntry: null,
      },
      {
        key: 'qa', label: 'QA', fullName: 'Quality Assurance',
        prefix: '', suffix: '%', weight: 1.0, rail: { min: -20, max: 20 },
        entryMode: 'percent', channelSplit: false,
        configKey: 'qa', configKeyVoice: null, configKeyMessaging: null,
        tamTargets: false, tamTargetMap: null, isQuality: true, maxEntry: 100,
      },
    ],
    hasQaReviews: true, qaMetricKey: 'qa', qaNotInMis: false,
    qaTabLabel: 'QA Reviews', hasDays: true, hasChannel: true,
    defaultConfig: {
      cpd:          { min: 14, target: 17,  max: 20  },
      gcrVoice:     { min: 40, target: 70,  max: 100 },
      gcrMessaging: { min: 15, target: 30,  max: 60  },
      qa:           { min: 70, target: 85,  max: 100 },
    },
  },

  activations: {
    label: 'Activations',
    fullName: 'Activations',
    metricDefs: [
      {
        key: 'agpv_win_rate', label: 'aGPV Win Rate', overviewLabel: 'WR', fullName: 'aGPV Win Rate',
        prefix: '', suffix: '%', weight: 1.0, rail: { min: -25, max: 25 },
        entryMode: 'percent', channelSplit: false,
        configKey: 'agpvWinRate', configKeyVoice: null, configKeyMessaging: null,
        tamTargets: true, tamTargetMap: { 'Level 1': 75, 'Level 2': 75 },
        tamTierMap: { 'Level 1': 'level1Target', 'Level 2': 'level2Target' },
        isQuality: false, maxEntry: 100,
      },
      {
        key: 'work_orders_day', label: 'Work Orders/Day', overviewLabel: 'WOD', fullName: 'Work Orders Per Day',
        prefix: '', suffix: '/day', weight: 1.0, rail: { min: -25, max: 25 },
        entryMode: 'perday', channelSplit: false,
        configKey: 'workOrdersDay', configKeyVoice: null, configKeyMessaging: null,
        tamTargets: true, tamTargetMap: { 'Level 1': 8, 'Level 2': 8 },
        tamTierMap: { 'Level 1': 'level1Target', 'Level 2': 'level2Target' },
        isQuality: false, maxEntry: null,
      },
      {
        key: 'aqi', label: 'AQI', overviewLabel: 'AQI', fullName: 'Activation Quality Index',
        prefix: '', suffix: '%', weight: 1.0, rail: { min: -25, max: 25 },
        entryMode: 'percent', channelSplit: false,
        configKey: 'aqi', configKeyVoice: null, configKeyMessaging: null,
        tamTargets: false, tamTargetMap: null, tamTierMap: null,
        isQuality: true, maxEntry: 100,
      },
    ],
    hasQaReviews: true, qaMetricKey: 'aqi', qaNotInMis: false,
    qaTabLabel: 'AQI Reviews', hasDays: true, hasChannel: false,
    defaultConfig: {
      agpvWinRate:   { level1Target: 75, level2Target: 75 },
      workOrdersDay: { level1Target: 8,  level2Target: 8  },
      aqi:           { target: 80 },
    },
  },

  escalations: {
    label: 'Escalations',
    fullName: 'Escalations',
    metricDefs: [
      {
        key: 'case_closures_day', label: 'Case Closures/Day', overviewLabel: 'CCD', fullName: 'Case Closures Per Day',
        prefix: '', suffix: '/day', weight: 1.0, rail: { min: -25, max: 25 },
        entryMode: 'perday', channelSplit: false,
        configKey: 'caseClosuresDay', configKeyVoice: null, configKeyMessaging: null,
        tamTargets: true, tamTargetMap: { 'Level 1': 8, 'Level 2': 5 },
        tamTierMap: { 'Level 1': 'level1Target', 'Level 2': 'level2Target' },
        isQuality: false, maxEntry: null,
      },
      {
        key: 'resolution_rate', label: 'Resolution Rate', overviewLabel: 'RR', fullName: 'Resolution Rate',
        prefix: '', suffix: '%', weight: 1.0, rail: { min: -25, max: 25 },
        entryMode: 'percent', channelSplit: false,
        configKey: 'resolutionRate', configKeyVoice: null, configKeyMessaging: null,
        tamTargets: false, tamTargetMap: null, isQuality: false, maxEntry: 100,
      },
      {
        key: 'non_queue_work_day', label: 'Non-Queue Work/Day', overviewLabel: 'NQW', fullName: 'Non-Queue Work Per Day',
        prefix: '', suffix: '/day', weight: 1.0, rail: { min: -25, max: 25 },
        entryMode: 'perday', channelSplit: false,
        configKey: 'nonQueueWorkDay', configKeyVoice: null, configKeyMessaging: null,
        tamTargets: true, tamTargetMap: { 'Level 1': 0.25, 'Level 2': 0.6 },
        tamTierMap: { 'Level 1': 'level1Target', 'Level 2': 'level2Target' },
        isQuality: false, maxEntry: null,
      },
    ],
    hasQaReviews: true, qaMetricKey: null, qaNotInMis: true,
    qaTabLabel: 'QA Reviews', hasDays: true, hasChannel: false,
    defaultConfig: {
      caseClosuresDay: { level1Target: 8,   level2Target: 5   },
      resolutionRate:  { target: 60 },
      nonQueueWorkDay: { level1Target: 0.25, level2Target: 0.6 },
    },
  },
}

export const TEAM_IDS = ['pss', 'activations', 'escalations']

export function resolveConfigByKey(metricDefs, config, channel, tamRole) {
  const configByKey = {}
  for (const def of metricDefs) {
    if (def.tamTargets) {
      const cfgEntry = config?.[def.configKey]
      let target
      if (def.tamTierMap) {
        const cfgKey = def.tamTierMap[tamRole] ?? def.tamTierMap[Object.keys(def.tamTierMap)[0]]
        target = cfgEntry?.[cfgKey] ?? def.tamTargetMap?.[tamRole]
      } else {
        target = tamRole === 'TAM 3'
          ? (cfgEntry?.tam3Target ?? def.tamTargetMap[tamRole])
          : (cfgEntry?.tam1_2Target ?? def.tamTargetMap[tamRole ?? 'TAM 1'])
      }
      configByKey[def.configKey] = { target }
    } else if (def.channelSplit) {
      const k = channel === 'messaging' ? def.configKeyMessaging : def.configKeyVoice
      configByKey[def.configKey] = k != null ? config?.[k] : config?.[def.configKey]
    } else {
      configByKey[def.configKey] = config?.[def.configKey]
    }
  }
  return configByKey
}
