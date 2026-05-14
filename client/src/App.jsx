import { useState, useEffect } from 'react'
import GuideView from './components/GuideView'
import SupervisorView from './components/SupervisorView'
import PasswordGate from './components/PasswordGate'
import { getConfig, saveConfig } from './utils/storage'
import './App.css'

const SESSION_KEY = 'pss-mis:supervisor'
const GUIDE_SESSION_KEY = 'pss-mis:guide'

export default function App() {
  const [role, setRole] = useState(null)
  const [showAbout, setShowAbout] = useState(false)
  const [supervisorUser, setSupervisorUser] = useState(() => sessionStorage.getItem(SESSION_KEY))
  const [guideUser, setGuideUser] = useState(() => sessionStorage.getItem(GUIDE_SESSION_KEY))
  const [config, setConfig] = useState(null)
  const [configLoading, setConfigLoading] = useState(true)

  useEffect(() => {
    getConfig()
      .then(cfg => { setConfig(cfg); setConfigLoading(false) })
      .catch(() => setConfigLoading(false))
  }, [])

  const handleConfigSave = async (cfg) => {
    await saveConfig(cfg)
    setConfig(cfg)
  }

  const handleLogOut = () => {
    sessionStorage.removeItem(SESSION_KEY)
    setSupervisorUser(null)
    setRole(null)
  }

  const handleGuideLogin = (name) => {
    sessionStorage.setItem(GUIDE_SESSION_KEY, name)
    setGuideUser(name)
  }

  const handleGuideLogout = () => {
    sessionStorage.removeItem(GUIDE_SESSION_KEY)
    setGuideUser(null)
  }

  const handleSwitchRole = () => {
    setRole(null)
  }

  if (configLoading) {
    return (
      <div className="role-select-screen">
        <h1>PSS Merchant Impact Score</h1>
        <p className="subtext">Loading…</p>
      </div>
    )
  }

  if (!role) {
    return (
      <div className="role-select-screen">
        <h1>PSS Merchant Impact Score</h1>
        <p>Select your role to continue</p>
        <div className="role-buttons">
          <button className="role-btn" onClick={() => setRole('guide')}>
            <span className="role-icon">👤</span>
            <span className="role-title">Guide</span>
            <span className="role-desc">Calculate my MIS score</span>
          </button>
          <button className="role-btn" onClick={() => setRole('supervisor')}>
            <span className="role-icon">📊</span>
            <span className="role-title">Supervisor</span>
            <span className="role-desc">View team scores & manage config</span>
          </button>
        </div>

        <section className="mis-about">
          <button className="mis-about-toggle" onClick={() => setShowAbout(v => !v)}>
            <span>About the Merchant Impact Score</span>
            <span className={`mis-about-chevron ${showAbout ? 'open' : ''}`}>&#x25BE;</span>
          </button>

          {showAbout && (
            <div className="mis-about-body">

              <div className="mis-about-section">
                <h3>Purpose and Scope</h3>
                <p>
                  The Merchant Impact Score (MIS) is a monthly composite performance metric used to evaluate the
                  commercial and service impact of each Technical Account Manager (TAM I and TAM II) within the
                  Commerce Advanced Support – PowerSeller Success Department. MIS is comprised of three metrics:
                  Contributions Per Day (CPD), Gross Cash Revenue Per Day (GCR), and Quality Assurance (QA).
                </p>
                <p>
                  TAM I and TAM II are required to maintain a Total MIS of 0.0 or higher each calendar month.
                  Failure to meet this minimum expectation will result in the application of the Performance
                  Improvement Process. MIS scores are intended to support performance coaching and team management
                  and do not, standing alone, constitute a basis for any formal employment action outside of the
                  processes described herein.
                </p>
              </div>

              <div className="mis-about-section">
                <h3>Accountability Timeline</h3>
                <p>
                  TAMs are held accountable to the monthly MIS minimum beginning on the first day of their second
                  full calendar month on their assigned team, following completion of classroom and on-the-job
                  training. This applies to both new external hires and internal transfers from other roles within
                  Care &amp; Services. During the New Hire Training Period and prior to that first accountability
                  date, TAMs will not be held to minimum metric expectations.
                </p>
                <p className="mis-example-note">
                  Example: If a TAM is assigned to their team on October 15th, MIS accountability begins December 1st.
                </p>
              </div>

              <div className="mis-about-section">
                <h3>Performance Dimensions</h3>
                <p>
                  MIS is calculated from three performance metrics. Monthly targets for each metric are established
                  by leadership and communicated at least three days before the start of the applicable month.
                </p>
                <div className="mis-metric-list">

                  <div className="mis-metric-item">
                    <span className="mis-metric-name">Contributions Per Day (CPD)</span>
                    <p>
                      The average number of merchant interactions completed per responsible day during the calendar
                      month. Responsible days are prorated to the minute for approved time off.
                    </p>
                    <p>CPD = Total Contributions ÷ Responsible Days</p>
                    <p>The following interaction types count toward CPD:</p>
                    <ul className="mis-calc-rules">
                      <li>Inbound phone calls</li>
                      <li>Outbound phone calls</li>
                      <li>Resolved cases</li>
                      <li>Inbound front of site chat messages</li>
                      <li>Inbound SMS messages</li>
                      <li>L2 chats</li>
                    </ul>
                    <p className="mis-example-note">
                      Example: A TAM has 46 inbound/outbound calls, 316 chats, and 123 resolved cases (485 total
                      contributions) over 20 responsible days.<br />
                      CPD = 485 ÷ 20 = <strong>24.25</strong>
                    </p>
                  </div>

                  <div className="mis-metric-item">
                    <span className="mis-metric-name">Gross Cash Revenue Per Day (GCR)</span>
                    <p>
                      The average daily cash revenue generated through a TAM's merchant activity over their
                      responsible days for the calendar month. GCR includes directly processed new sales as well
                      as commerce revenue generated through campaigns that is not recognized through new sales
                      (for example, GD Capital fees paid). Responsible days are prorated to the minute for
                      approved time off.
                    </p>
                    <p className="mis-example-note">
                      Example: A TAM has $8,500 in new sales and $1,250 in GD Capital fees paid over
                      18.31 responsible days.<br />
                      GCR = ($8,500 + $1,250) ÷ 18.31 = <strong>$532.49/day</strong>
                    </p>
                  </div>

                  <div className="mis-metric-item">
                    <span className="mis-metric-name">Quality Assurance Score (QA)</span>
                    <p>
                      The average score across a minimum of four randomly selected interaction reviews conducted
                      by leadership during the calendar month.
                    </p>
                    <p>QA = Sum of Review Scores ÷ Number of Reviews</p>
                    <p className="mis-example-note">
                      Example: Four reviews return scores of 80, 85, 100, and 50.<br />
                      QA = (80 + 85 + 100 + 50) ÷ 4 = <strong>78.75</strong>
                    </p>
                  </div>

                </div>
              </div>

              <div className="mis-about-section">
                <h3>Score Calculation</h3>
                <p>
                  Each metric is scored on a linear scale anchored to three monthly thresholds: a minimum, a target,
                  and a maximum. Performing exactly at target earns 0 points. Performance above target earns positive
                  points proportional to how close the result is to the maximum; performance below target loses points
                  proportional to how close the result is to the minimum.
                </p>
                <div className="mis-formula-block">
                  <div className="mis-formula-row">
                    <span className="mis-formula-label">At target</span>
                    <span className="mis-formula-expr">0 points</span>
                  </div>
                  <div className="mis-formula-row">
                    <span className="mis-formula-label">Above target</span>
                    <span className="mis-formula-expr">((actual − target) ÷ (max − target)) × rail max &nbsp;[capped at rail max]</span>
                  </div>
                  <div className="mis-formula-row">
                    <span className="mis-formula-label">Below target</span>
                    <span className="mis-formula-expr">−((target − actual) ÷ (target − min)) × |rail min| &nbsp;[floored at rail min]</span>
                  </div>
                  <div className="mis-formula-row mis-formula-total">
                    <span className="mis-formula-label">Total MIS</span>
                    <span className="mis-formula-expr">CPD points + GCR points + QA points</span>
                  </div>
                </div>
                <p>
                  Each metric's point value is rounded to the nearest hundredth before being added to the Total MIS.
                  The Total MIS is then independently rounded to the nearest hundredth as well.
                </p>
                <p>Each metric has a fixed point range that bounds how much it can contribute to or detract from the Total MIS:</p>
                <table className="mis-rails-table">
                  <thead>
                    <tr><th>Metric</th><th>Min Points</th><th>Max Points</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>Contributions Per Day (CPD)</td><td>−35</td><td>+35</td></tr>
                    <tr><td>Gross Cash Revenue Per Day (GCR)</td><td>−20</td><td>+20</td></tr>
                    <tr><td>Quality Assurance (QA)</td><td>−20</td><td>+20</td></tr>
                    <tr className="mis-rails-total"><td>Total MIS</td><td>−75</td><td>+75</td></tr>
                  </tbody>
                </table>

                <p className="mis-subsection-label">Example — On Track</p>
                <p className="mis-example-note">
                  Monthly thresholds: CPD min 14 / target 17 / max 20 &nbsp;·&nbsp;
                  GCR min $40 / target $70 / max $100 &nbsp;·&nbsp;
                  QA min 70% / target 85% / max 100%
                </p>
                <table className="mis-example-table">
                  <thead>
                    <tr><th>Metric</th><th>Target</th><th>Result</th><th>Calculation</th><th>Points</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>CPD</td><td>17</td><td>19</td>
                      <td className="mis-calc-cell">((19 − 17) ÷ (20 − 17)) × 35</td>
                      <td className="mis-pts-pos">+23.33</td>
                    </tr>
                    <tr>
                      <td>GCR</td><td>$70</td><td>$85</td>
                      <td className="mis-calc-cell">((85 − 70) ÷ (100 − 70)) × 20</td>
                      <td className="mis-pts-pos">+10.00</td>
                    </tr>
                    <tr>
                      <td>QA</td><td>85%</td><td>92%</td>
                      <td className="mis-calc-cell">((92 − 85) ÷ (100 − 85)) × 20</td>
                      <td className="mis-pts-pos">+9.33</td>
                    </tr>
                    <tr className="mis-example-total">
                      <td colSpan={4}>Total MIS</td>
                      <td><span className="mis-status-on">+42.67 — On Track ✓</span></td>
                    </tr>
                  </tbody>
                </table>

                <p className="mis-subsection-label">Example — Off Track</p>
                <p className="mis-example-note">Same monthly thresholds as above.</p>
                <table className="mis-example-table">
                  <thead>
                    <tr><th>Metric</th><th>Target</th><th>Result</th><th>Calculation</th><th>Points</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>CPD</td><td>17</td><td>15</td>
                      <td className="mis-calc-cell">−((17 − 15) ÷ (17 − 14)) × 35</td>
                      <td className="mis-pts-neg">−23.33</td>
                    </tr>
                    <tr>
                      <td>GCR</td><td>$70</td><td>$55</td>
                      <td className="mis-calc-cell">−((70 − 55) ÷ (70 − 40)) × 20</td>
                      <td className="mis-pts-neg">−10.00</td>
                    </tr>
                    <tr>
                      <td>QA</td><td>85%</td><td>78%</td>
                      <td className="mis-calc-cell">−((85 − 78) ÷ (85 − 70)) × 20</td>
                      <td className="mis-pts-neg">−9.33</td>
                    </tr>
                    <tr className="mis-example-total">
                      <td colSpan={4}>Total MIS</td>
                      <td><span className="mis-status-off">−42.67 — Off Track ✗</span></td>
                    </tr>
                  </tbody>
                </table>

                <p className="mis-example-note">
                  Results at or below the minimum threshold are floored at the rail minimum; results at or above
                  the maximum threshold are capped at the rail maximum.
                </p>
              </div>

              <div className="mis-about-section">
                <h3>Minimum Performance Expectations</h3>
                <p>
                  TAM I and TAM II must achieve a Total MIS <strong>greater than 0</strong> each calendar month.
                  A TAM whose Total MIS is above 0 is designated{' '}
                  <strong className="mis-status-on">On Track</strong> and has satisfied the monthly MIS minimum
                  expectation.
                </p>
                <p>
                  A TAM whose Total MIS is 0 or below is designated{' '}
                  <strong className="mis-status-off">Off Track</strong> and will be subject to the Performance
                  Improvement Process.
                </p>
                <div className="mis-callout mis-callout-neutral">
                  <strong>Performance Improvement Plan (PIP)</strong>
                  <p>
                    A PIP will be issued when a TAM fails to meet the minimum MIS expectation for a calendar month.
                    TAMs are permitted no more than two PIPs within any rolling 12-month period. A successfully
                    completed PIP rolls off 12 months after its issue date. Failure to achieve the goals outlined
                    in a PIP, or any extension thereof, may result in transfer or termination of employment at
                    GoDaddy's discretion.
                  </p>
                </div>
              </div>

              <div className="mis-about-section">
                <h3>Confidentiality and Appropriate Use</h3>
                <p>
                  Individual MIS scores and the underlying performance data are confidential. Access is restricted
                  to the individual TAM to whom the score applies and authorized supervisors within the Powerseller
                  Success team. Permitted uses include:
                </p>
                <ul className="mis-calc-rules">
                  <li>Monthly individual performance coaching conversations</li>
                  <li>Team performance trend analysis and operational planning</li>
                  <li>Supporting documentation in structured performance management processes, where applicable</li>
                </ul>
                <p>
                  MIS scores must not be shared with unauthorized parties or used for purposes outside those
                  described above. This document is not a contract. GoDaddy reserves the right to change, modify,
                  or suspend these guidelines and their application to any individual employee at its sole
                  discretion and at any time without notice.
                </p>
              </div>

            </div>
          )}
        </section>
      </div>
    )
  }

  if (role === 'supervisor' && !supervisorUser) {
    return (
      <PasswordGate
        onSuccess={(username) => {
          sessionStorage.setItem(SESSION_KEY, username)
          setSupervisorUser(username)
        }}
      />
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>PSS Merchant Impact Score</h1>
        <div className="header-actions">
          <button className="btn-ghost" onClick={handleSwitchRole}>Switch Role</button>
          {role === 'supervisor' && (
            <button className="btn-ghost" onClick={handleLogOut}>Log Out</button>
          )}
        </div>
      </header>
      <main>
        {role === 'guide'
          ? <GuideView config={config} guideUser={guideUser} onGuideLogin={handleGuideLogin} onGuideLogout={handleGuideLogout} />
          : <SupervisorView config={config} onConfigSave={handleConfigSave} currentUser={supervisorUser} />
        }
      </main>
    </div>
  )
}
