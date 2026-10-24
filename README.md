# SHOPMART

SHOPMART is a React storefront backed by an Express, MongoDB, and Razorpay API. It includes customer and seller registration, product browsing and listings, cart persistence, coupon validation, checkout, order history, and an admin dashboard.

## Requirements

- Node.js 20.19+ or 22.12+
- MongoDB (local or hosted)
- Razorpay test keys for checkout

## Configure

Create `backend\.env` from `backend\.env.example` and set `MONGO_URI` and a long, private `JWT_SECRET`. Add the Razorpay test key ID and secret to enable checkout. Set `GOOGLE_CLIENT_ID` in the backend and the same `VITE_GOOGLE_CLIENT_ID` in `frontend\.env` to enable Google sign-in. Create `frontend\.env` from `frontend\.env.example` if the API is not running at `http://localhost:5000/api`.

## Run locally

Open two terminals:

```powershell
cd backend
npm install
npm run dev
```

```powershell
cd frontend
npm install
npm run dev
```

The API health check is available at `http://localhost:5000/api/health`. The frontend runs at the Vite URL shown in its terminal.

## First-time setup

1. Register a seller account, then publish products from the seller dashboard. Sellers can upload up to six JPEG, PNG, WebP, or GIF product images (5 MB per image); administrators can also upload a main image and up to five related images. Uploaded files are saved under `backend\uploads\product-images` and served by the API. Keep that folder on persistent storage and include it in backups; it is not stored in MongoDB. The admin Products module supports product search, category/stock/price filters, sorting, pagination, full product/image viewing, and editing product details and images.
2. Footer links open store information, customer-service, policy, and order-tracking pages. Newsletter subscriptions are stored in MongoDB; the newsletter endpoint records subscriber email addresses but does not send email campaigns unless a mail delivery service is configured.
3. Register a customer account to browse, add products to the cart, and place orders.
4. To create the initial administrator, register an account and promote it directly in MongoDB. For example, in `mongosh`, replace the email with the account you registered:

   ```javascript
   db.users.updateOne(
     { email: "admin@example.com" },
     { $set: { role: "admin" } }
   )
   ```

   Sign in with that account to open the admin dashboard. Public registration intentionally does not allow creating administrator accounts.
   Administrators can manage the homepage promotions in **Homepage Banners**: add, edit, order, activate, or remove banners. Up to 10 active banners rotate in the storefront slider. Banner images can be uploaded as JPEG, PNG, WebP, or GIF files (up to 5 MB) or linked from HTTPS; banner buttons can only link to internal store pages. Uploaded banner images are stored under `backend\uploads\banner-images` and served by the API.
5. Replace the placeholder `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` values in `backend/.env` with valid Razorpay test credentials before online checkout, then restart the backend. Payment verification is performed by the API; the browser never supplies product prices or the final order amount.
6. Configure `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASSWORD` in `backend/.env` to send account welcome, password reset, and confirmed-order emails. `SMTP_PORT` defaults to `587` and `SMTP_SECURE` defaults to TLS behavior for that port; use port `465` with `SMTP_SECURE=true` for implicit TLS when required by your provider. `MAIL_FROM` is optional and defaults to the SMTP username. Use the exact `SMTP_PASSWORD` variable (many providers require an app password rather than your normal sign-in password), then restart the backend after changing `.env`. The development server watches `.env` and restarts when it changes; restart `npm start` or the deployed service manually. Keep credentials private and do not commit or share them. Without valid SMTP configuration, accounts and orders still work, but transactional emails cannot be delivered.

Customers, sellers, and administrators can change their password from their account dashboard. The sign-in page also offers a one-hour password-reset link sent to the account email when SMTP is configured.

Seller registrations remain pending until an administrator approves them from the **Sellers** section. Pending sellers cannot sign in. Each seller is assigned a unique seller code, visible to the seller in their dashboard and to administrators in seller details. Administrators can also inspect customer/seller account details and activate or deactivate accounts; deactivation invalidates existing sessions.

Customers, sellers, and administrators can update their name, mobile number, profile photo, and primary address from their account dashboard. Profile photos accept JPEG, PNG, WebP, or GIF files up to 2 MB and are stored in the backend uploads directory.

Administrators can review opted-in newsletter subscribers and compose promotional email campaigns from the **Newsletter** dashboard section. Campaigns may include an active homepage banner, are delivered individually in the background, and show delivery progress and results. Uploaded banner images are embedded in the email; externally hosted images must use a publicly reachable HTTPS URL. Promotional emails include a signed unsubscribe link; subscribers who unsubscribe are excluded from future sends. Configure `PUBLIC_API_URL` to the publicly reachable API base URL ending in `/api` so unsubscribe links work in production.

SMTP acceptance does not guarantee inbox placement. To improve newsletter deliverability, configure SPF and DKIM for the sender domain with your email provider, publish a DMARC policy, and use a verified sender address aligned with that domain. Recipients may still see messages in spam depending on provider reputation and engagement.

### Google sign-in

1. Create a Google OAuth 2.0 **Web application** client in Google Cloud Console.
2. Add the storefront origins to the client's **Authorized JavaScript origins** (for local development, `http://localhost:5173`; add the deployed HTTPS origin in production).
3. Set the same client ID in `backend\.env` as `GOOGLE_CLIENT_ID` and `frontend\.env` as `VITE_GOOGLE_CLIENT_ID`, then restart both applications.

Google ID tokens are verified by the backend against that client ID, and Google must report a verified email. New Google accounts are created as customers. An existing account can be linked when the verified Google email matches; public Google sign-up cannot create seller or administrator accounts.

The homepage slider rotates active banners automatically and also has previous/next and direct-slide controls. The promotion area includes share links for Facebook, LinkedIn, WhatsApp, and X, a native device share option where supported, and a copy-link action for Instagram.

Products support optional size and color choices configured by sellers or administrators. Customers must choose valid available options before checkout; the API verifies those choices against the current product. Customers with a completed order can submit one 1- to 5-star review per product, and public product pages show verified-purchase reviews and the aggregate rating.

Customer accounts can save up to 10 Home or Work delivery addresses from checkout or the customer dashboard. Checkout requires selecting one of those saved addresses, and the API verifies the selected address belongs to the signed-in customer. Customers can also save products to a persistent wishlist from product pages, product listings, or the cart, and manage saved products from the customer dashboard.

The storefront displays global success and error toast notifications for API actions, including backend validation and network errors. Cart changes and invalid form submissions also display toast feedback.

## Validation

```powershell
cd frontend
npm run lint
npm run build
```
