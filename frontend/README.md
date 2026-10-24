# SHOPMART frontend

React 19 and Vite storefront. To run it, configure `VITE_API_URL` if the backend is not at `http://localhost:5000/api`, then run:

```powershell
npm install
npm run dev
```

The frontend includes catalog search and category filtering, product details, persistent cart, customer/seller account flows, coupon validation, and Razorpay checkout. MongoDB and backend/payment setup instructions are in the repository [README](../README.md).

Build and lint with:

```powershell
npm run build
npm run lint
```
