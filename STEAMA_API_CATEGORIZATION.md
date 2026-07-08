# STEAMA API - Comprehensive Categorization & Use Cases

**Document Created:** July 7, 2026  
**Purpose:** Categorize all Steama APIs for building a Management Platform & Mobile Application

---

##  PROJECT GOALS

### 1. **Management Platform** (Web/Desktop)
- Monitor and manage all meters, customers, and operations
- View analytics, reports, and system health
- Manage agents/vendors
- Configure tariffs and pricing
- Handle customer support and communications

### 2. **Mobile Application** (Customer-Facing)
- Allow customers to buy electricity units
- View consumption history and patterns
- Check account balance in real-time
- Receive notifications and alerts
- Manage account settings
- View transaction history

### 3. **Implementation Guardrails (Must Follow)**
- Build only features that map directly to available Steama API endpoints
- Current deployment profile: single plaza in Abuja (no multi-city location complexity)
- Current meter profile: ~30+ total meters with 3 bulk meters and prepaid downstream meters
- Focus on essentials: readings ingestion, monthly kWh reporting, customer/department spend reporting, and purchase transaction records
- Keep data model tenant-ready for future estates/malls without forcing location-heavy UX today

---

##  API-FIRST MVP SCOPE (Current Build)

The current MVP should use only these endpoint groups as primary scope:

1. Meter inventory and status:
   - `/meters/`
2. Meter readings and totals:
   - `/meter-metric-readings/`
   - `/meter-metric-totals/`
3. Customer profile and balance:
   - `/customers/`
   - `/account-balances/`
4. Purchase and spend tracking:
   - `/customers/{id}/transactions/`
   - `/transactions/`
   - `/revenue/`
5. Operational alerts:
   - `/alerts/`

Out of scope for MVP unless explicitly required:
- Multi-site/site management UX
- Advanced infrastructure pages (feeders/inverters/bitharvesters)
- Forecast-heavy dashboards not required for monthly reporting

---

##  API CATEGORIZATION BY FUNCTIONALITY

### **CATEGORY 1: CUSTOMER MANAGEMENT**
*APIs for managing customer accounts, balances, and profiles*

| API Endpoint | Operations | Key Use Cases |
|-------------|-----------|---------------|
| **`/customers/`** | List, Read, Update, Create |  View all customers<br> Create new customer accounts<br> Update customer information<br> Search/filter customers |
| **`/account-balances/`** | List (Read-only) |  View customer balance history<br> Track balance trends<br> Display current balance in mobile app |
| **`/customers/{id}/transactions/`** | List, Create |  **CRITICAL FOR MOBILE APP**: Record payment transactions<br> View transaction history<br> Process unit purchases |
| **`/customer-audit-logs/`** | List (Read-only) |  Track customer account changes<br> Audit trail for compliance |

**Mobile App Priority:**  (Essential)  
**Management Platform Priority:**  (Essential)

---

### **CATEGORY 2: METER MANAGEMENT & MONITORING**
*APIs for meter operations, readings, and control*

| API Endpoint | Operations | Key Use Cases |
|-------------|-----------|---------------|
| **`/meters/`** | List, Read, Update, Create |  View all meters and their status<br> Register new meters<br> Update meter configuration<br> Check if meter is ON/OFF<br> Monitor communication status |
| **`/meter-metric-readings/`** | List (Read-only) |  **CRITICAL**: Get consumption data (kWh)<br> Display usage graphs<br> Export meter readings (CSV)<br> Time-series energy data |
| **`/meter-metrics/`** | List (Read-only) |  Available metrics (Voltage, Current, Power, etc.)<br> Metric definitions and units |
| **`/meter-metric-totals/`** | List (Read-only) |  Aggregated consumption totals<br> Daily/monthly summaries |
| **`/meter-audit-logs/`** | List (Read-only) |  Track meter configuration changes<br> Compliance and troubleshooting |
| **`/meter-manufacturers/`** | List, Read |  Meter hardware information<br> Supported meter types |
| **`/meter-commission-data/`** | List (Read-only) |  Initial meter setup data<br> Installation records |

**Mobile App Priority:**  (High - for showing consumption)  
**Management Platform Priority:**  (Essential)

---

### **CATEGORY 3: METER CONTROL & COMMANDS**
*APIs for sending commands to meters (Turn ON/OFF, set tariffs, etc.)*

| API Endpoint | Operations | Key Use Cases |
|-------------|-----------|---------------|
| **`/directives/`** | List, Read, Create |  **CRITICAL**: Turn meters ON/OFF<br> Set tariff rates<br> Update meter firmware<br> Configure meter parameters<br> Emergency disconnect<br> Set credit limits |

**Directive Types Available:**
- `CONNECT` - Turn meter ON
- `DISCONNECT` - Turn meter OFF  
- `SET_TARIFF` - Update pricing
- `SET_CREDIT_LIMIT` - Adjust credit threshold
- `FIRMWARE_UPDATE` - Update meter software
- And many more...

**Mobile App Priority:**  (Medium - auto-ON after payment)  
**Management Platform Priority:**  (Essential)

---

### **CATEGORY 4: PAYMENT & TRANSACTIONS**
*APIs for processing payments and managing financial transactions*

| API Endpoint | Operations | Key Use Cases |
|-------------|-----------|---------------|
| **`/customers/{id}/transactions/`** | List, Create |  **MOBILE APP CORE**: Record unit purchases<br> Payment processing<br> Top-up accounts<br> Transaction history |
| **`/transactions/`** | List (Read-only) |  General transaction ledger<br> All system transactions |
| **`/agent-transactions/`** | List, Create |  Vendor/agent payment records<br> Commission tracking |
| **`/invalid-payments/`** | List, Read |  Failed payment tracking<br> Payment reconciliation |
| **`/revenue/`** | List (Read-only) |  Revenue analytics<br> Financial reporting |
| **`/payment-counts/`** | List (Read-only) |  Payment statistics<br> Dashboard metrics |

**Mobile App Priority:**  (Essential - core feature)  
**Management Platform Priority:**  (Essential)

---

### **CATEGORY 5: COMMUNICATION & MESSAGING**
*APIs for sending notifications and messages to customers*

| API Endpoint | Operations | Key Use Cases |
|-------------|-----------|---------------|
| **`/messages/`** | List, Read, Create |  System-wide messaging |
| **`/customer-messages/`** | List, Read, Create |  **MOBILE APP**: Push notifications<br> Payment confirmations<br> Low balance alerts<br> Service announcements |
| **`/agent-messages/`** | List, Read, Create |  Agent/vendor communications |
| **`/bitharvester-messages/`** | List, Read, Create |  System-level messages |

**Mobile App Priority:**  (High - for notifications)  
**Management Platform Priority:**  (High)

---

### **CATEGORY 6: ALERTS & MONITORING**
*APIs for system alerts, outages, and monitoring*

| API Endpoint | Operations | Key Use Cases |
|-------------|-----------|---------------|
| **`/alerts/`** | List, Read, Update |  Meter offline alerts<br> Low balance warnings<br> System health monitoring |
| **`/alert-actions/`** | List, Read |  Alert automation rules<br> Alert responses |
| **`/comms-uptime/`** | List (Read-only) |  Communication uptime statistics<br> Network health monitoring |
| **`/availability-hours/`** | List (Read-only) |  Power outage tracking<br> Service availability reports |
| **`/online-meters-counts/`** | List (Read-only) |  Dashboard: Online vs offline meters<br> Real-time system status |
| **`/active-meter-counts/`** | List (Read-only) |  Active meter statistics |
| **`/dlms-event-logs/`** | List (Read-only) |  Meter event logs (DLMS protocol)<br> Advanced diagnostics |

**Mobile App Priority:**  (Medium - for outage notifications)  
**Management Platform Priority:**  (Essential - for monitoring)

---

### **CATEGORY 7: AGENT/VENDOR MANAGEMENT**
*APIs for managing payment agents and vendors*

| API Endpoint | Operations | Key Use Cases |
|-------------|-----------|---------------|
| **`/agents/`** | List, Read, Update, Create |  Manage payment agents/vendors<br> Agent registration<br> Commission setup |
| **`/agent-transactions/`** | List, Create |  Track agent sales<br> Commission calculations<br> Agent performance |

**Mobile App Priority:**  (Low - not customer-facing)  
**Management Platform Priority:**  (High - if using agent network)

---

### **CATEGORY 8: INFRASTRUCTURE & HARDWARE**
*APIs for managing physical infrastructure*

| API Endpoint | Operations | Key Use Cases |
|-------------|-----------|---------------|
| **`/bitharvesters/`** | List, Read, Update |  Data concentrator units<br> Communication gateways |
| **`/bitharvester-metrics/`** | List (Read-only) |  Gateway performance metrics |
| **`/bitharvester-metric-readings/`** | List (Read-only) |  Gateway telemetry data |
| **`/feeders/`** | List, Read, Update |  Electrical feeder management<br> Distribution network |
| **`/feeder-audit-logs/`** | List (Read-only) |  Feeder change history |
| **`/inverters/`** | List, Read, Update |  Solar inverter management |
| **`/inverter-metrics/`** | List (Read-only) |  Inverter performance data |
| **`/sites/`** | List, Read, Update |  Physical site/location management |
| **`/site-metrics/`** | List (Read-only) |  Site-level analytics |
| **`/network-providers/`** | List, Read |  Telecom provider management |

**Mobile App Priority:**  (Not needed)  
**Management Platform Priority:**  (High - for operations)

---

### **CATEGORY 9: ANALYTICS & REPORTING**
*APIs for data analysis and business intelligence*

| API Endpoint | Operations | Key Use Cases |
|-------------|-----------|---------------|
| **`/stats/`** | List (Read-only) |  System-wide statistics<br> Dashboard KPIs |
| **`/revenue/`** | List (Read-only) |  Revenue reports<br> Financial analytics |
| **`/forecasts/`** | List (Read-only) |  Energy demand forecasting<br> Capacity planning |
| **`/grid-metrics/`** | List (Read-only) |  Grid performance data |
| **`/import-energy/`** | List (Read-only) |  Energy import tracking |
| **`/reactive-energy/`** | List (Read-only) |  Power quality metrics |
| **`/distribution-losses/`** | List (Read-only) |  Technical/commercial losses |
| **`/utility-usage/`** | List (Read-only) |  Aggregate usage analytics |
| **`/utility-readings/`** | List (Read-only) |  Bulk meter readings |
| **`/residual-energy-balance/`** | List (Read-only) |  Energy balance calculations |
| **`/response-efficiency/`** | List (Read-only) |  System response metrics |

**Mobile App Priority:**  (Low - maybe usage trends)  
**Management Platform Priority:**  (Essential - for analytics)

---

### **CATEGORY 10: SYSTEM CONFIGURATION**
*APIs for system settings and configuration*

| API Endpoint | Operations | Key Use Cases |
|-------------|-----------|---------------|
| **`/projects/`** | List, Read |  Multi-project management<br> Project configuration |
| **`/utilities/`** | List, Read |  Utility company settings |
| **`/exchange-rates/`** | List, Read |  Currency conversion rates |
| **`/tags/`** | List, Read, Update, Create |  Custom tagging system<br> Categorization |
| **`/tag-audit-logs/`** | List (Read-only) |  Tag change history |
| **`/user-administration/`** | List, Read, Update |  User account management<br> Access control |
| **`/my-account/`** | Read, Update |  Current user profile |
| **`/communication-methods/`** | List, Read |  Available comm channels (GPRS, etc.) |

**Mobile App Priority:**  (Low - maybe user profile)  
**Management Platform Priority:**  (High - for admin)

---

##  RECOMMENDED MOBILE APP FEATURES & API MAPPING

### **Core Features for Customer Mobile App:**

#### 1. **User Authentication**
- **API:** `/get-token/` (POST)
- **Flow:** Backend service authenticates with Steama using service credentials; mobile/web clients never store Steama credentials or tokens

#### 2. **Dashboard / Home Screen**
```
Components:
 Current Balance  GET /customers/{id}/ (account_balance field)
 Meter Status (ON/OFF)  GET /meters/{id}/ (connection_is_on fields)
 Recent Transactions  GET /customers/{id}/transactions/
 Usage Today/This Month  GET /meters/{id}/metrics/{metric}/readings/
```

#### 3. **Buy Units / Recharge**
```
Workflow:
1. User enters amount to purchase
2. POST /customers/{id}/transactions/ with payment details
   {
     "amount": "50.00",
     "payment_method": "mobile_money",
     "description": "Unit purchase via mobile app"
   }
3. Backend processes payment
4. Meter automatically turns ON (if was OFF due to low balance)
5. Send confirmation via GET/POST /customer-messages/
```

#### 4. **Usage History**
```
Display:
 Daily/Weekly/Monthly consumption
 Usage graphs and trends
 Cost breakdown

API: GET /meters/{meter_id}/metrics/{metric}/readings/
     ?start_time=2026-06-01&end_time=2026-07-01
```

#### 5. **Transaction History**
```
API: GET /customers/{id}/transactions/?ordering=-timestamp
Display: Date, Amount, Balance After, Description
```

Updated API note:
```
Primary transaction-history path for this tenant is:
GET /customers/{id}/transactions/?ordering=-timestamp

Top-level /transactions/ remains useful for management-ledger and reconciliation queries.
```

#### 6. **Notifications**
```
APIs:
 GET /customer-messages/?customer={id} (Fetch messages)
 GET /alerts/?meter={meter_id} (Low balance alerts)
 Push notification integration
```

#### 7. **Account Management**
```
APIs:
 GET /customers/{id}/ (View profile)
 PATCH /customers/{id}/ (Update phone, email, etc.)
 GET /meters/?customer={id} (View assigned meters)
```

---

##  RECOMMENDED MANAGEMENT PLATFORM FEATURES

### **Dashboard Modules:**

#### 1. **Operations Dashboard**
- Total meters online/offline (`/online-meters-counts/`)
- Active meters (`/active-meter-counts/`)
- Communication uptime (`/comms-uptime/`)
- Recent alerts (`/alerts/`)

#### 2. **Customer Management**
- Customer list with search/filter (`/customers/`)
- Customer details and history
- Manual transaction entry (`/customers/{id}/transactions/`)
- Account balance trends (`/account-balances/`)

#### 3. **Meter Management**
- Meter registry (`/meters/`)
- Send commands/directives (`/directives/`)
- View meter readings (`/meter-metric-readings/`)
- Meter diagnostics

#### 4. **Financial Reports**
- Revenue analytics (`/revenue/`)
- Payment counts (`/payment-counts/`)
- Transaction ledger (`/transactions/`)
- Agent commissions (`/agent-transactions/`)

#### 5. **Network Monitoring**
- BitHarvester status (`/bitharvesters/`)
- Communication health
- Grid metrics (`/grid-metrics/`)
- Distribution losses

#### 6. **Agent/Vendor Management**
- Agent registry (`/agents/`)
- Agent transactions and commissions
- Performance tracking

---

##  AUTHENTICATION & SECURITY

### **Getting an API Token:**
```http
POST https://api.steama.co/get-token/
Content-Type: application/json

{
   "username": "<STEAMA_SERVICE_USERNAME>",
   "password": "<STEAMA_SERVICE_PASSWORD>"
}

Response:
{
   "token": "<STEAMA_TOKEN>"
}
```

### **Using the Token:**
```http
GET https://api.steama.co/customers/
Authorization: Token <STEAMA_TOKEN>
```

### **Security Recommendations:**
-  Keep Steama credentials and Steama tokens server-side only
-  Mobile/web clients authenticate to MSM backend, not directly to Steama
-  Implement token rotation/refresh strategy in backend integration service
-  Use HTTPS for all API calls
-  Never expose credentials in code
-  Implement rate limiting (current: 10 requests/second)
-  Validate all user inputs before sending to API

---

##  MOBILE APP TECHNOLOGY STACK RECOMMENDATIONS

### **Option 1: Cross-Platform (Recommended)**
- **Framework:** Flutter
- **Advantages:** Single codebase for iOS & Android
- **API Integration:** HTTP client (dio)

### **Option 2: Native**
- **Android:** Kotlin + Retrofit
- **iOS:** Swift + Alamofire
- **Advantages:** Best performance and native features

### **Backend Integration:**
- REST API calls to Steama endpoints
- JWT token management
- Local caching for offline viewing
- Push notifications (FCM/APNS)

---

##  TYPICAL USER FLOW - MOBILE APP

```
1. User Opens App
    Check if token exists
       Yes  Load Dashboard
       No  Show Login Screen

2. User Logs In
   Login to MSM backend
      MSM backend handles Steama token lifecycle securely

3. Dashboard Loads
    GET /customers/{id}/  Display name, balance
    GET /meters/?customer={id}  Get meter info
    GET /meter-metric-readings/  Show recent usage

4. User Wants to Buy Units
    Select amount (predefined or custom)
    Choose payment method
    Confirm purchase
   POST /customers/{id}/transactions/
       Success  Show confirmation
          Refresh balance
       Error  Show error message

5. User Checks Usage
    GET /meters/{id}/metrics/ENERGY/readings/
       Display graph (daily/weekly/monthly)

6. User Receives Notification
    GET /customer-messages/ (poll or webhook)
       Display in notification center
```

---

##  KEY METRICS TO TRACK

### **For Mobile App:**
- Number of transactions per day
- Average transaction value
- Active users (daily/monthly)
- App crashes/errors
- API response times

### **For Management Platform:**
- Total meters managed
- Customer count
- Revenue trends
- System uptime
- Alert response times

---

##  NEXT STEPS

### **Phase 1: Research & Planning** (Current)
-  Explore all APIs
-  Categorize by functionality
-  Define feature requirements
-  Create user flow diagrams
-  Select technology stack

### **Phase 2: MVP Development**
1. **Mobile App MVP:**
   - Login/Authentication
   - View balance
   - Buy units (payment integration)
   - View recent transactions
   - Basic notifications

2. **Management Platform MVP:**
   - Dashboard (key metrics)
   - Customer list
   - Meter management
   - Basic reporting

### **Phase 3: Testing & Launch**
- Beta testing with select customers
- Security audit
- Performance optimization
- Production deployment

### **Phase 4: Enhancement**
- Advanced analytics
- More payment methods
- Automated alerts
- Mobile wallet integration

---

##  SUPPORT & RESOURCES

- **API Documentation:** https://api.steama.co/docs/
- **API Base URL:** https://api.steama.co/
- **Support:** support@steama.co
- **Help Centre:** https://support.steama.co/

---

##  BUSINESS OPPORTUNITIES

### **Revenue Streams:**
1. **Transaction Fees:** Small fee per mobile app purchase
2. **Premium Features:** Advanced analytics for management users
3. **Agent Commissions:** Revenue from agent network
4. **API Integration:** Charge for third-party integrations

### **Value Propositions:**
- **For Customers:** Convenient 24/7 unit purchasing
- **For Utility:** Reduced operational costs, better cash flow
- **For Agents:** Increased sales through app referrals

---

**Document Version:** 1.0  
**Last Updated:** July 7, 2026  
**Contact:** sadiq.yusuf@steama.co


