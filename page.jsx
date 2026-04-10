'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

export default function DepositCheckout() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    clientName: '',
    eventDate: '',
    eventType: '',
    depositAmount: '',
    email: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Call your backend API to create a Stripe Checkout session
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          depositAmount: parseInt(formData.depositAmount) * 100, // Convert to cents
        }),
      });

      const { sessionId } = await response.json();
      const stripe = await stripePromise;
      await stripe.redirectToCheckout({ sessionId });
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="checkout-container">
      <div className="checkout-card">
        <div className="checkout-header">
          <h1>Catering Deposit</h1>
          <p>Secure your event with a deposit payment</p>
        </div>

        <form onSubmit={handleCheckout} className="checkout-form">
          <div className="form-group">
            <label htmlFor="clientName">Your Name</label>
            <input
              id="clientName"
              name="clientName"
              type="text"
              placeholder="John Doe"
              value={formData.clientName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="eventDate">Event Date</label>
              <input
                id="eventDate"
                name="eventDate"
                type="date"
                value={formData.eventDate}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="eventType">Event Type</label>
              <select
                id="eventType"
                name="eventType"
                value={formData.eventType}
                onChange={handleChange}
                required
              >
                <option value="">Select...</option>
                <option value="corporate">Corporate</option>
                <option value="wedding">Wedding</option>
                <option value="birthday">Birthday</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="depositAmount">Deposit Amount ($)</label>
            <input
              id="depositAmount"
              name="depositAmount"
              type="number"
              placeholder="500"
              min="1"
              step="0.01"
              value={formData.depositAmount}
              onChange={handleChange}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="checkout-button"
          >
            {loading ? 'Processing...' : 'Pay Deposit Now'}
          </button>
        </form>
      </div>

      <style jsx>{`
        .checkout-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .checkout-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          max-width: 500px;
          width: 100%;
          padding: 40px;
        }

        .checkout-header {
          margin-bottom: 30px;
          text-align: center;
        }

        .checkout-header h1 {
          font-size: 28px;
          font-weight: 700;
          color: #1a1a1a;
          margin: 0 0 8px 0;
        }

        .checkout-header p {
          font-size: 14px;
          color: #666;
          margin: 0;
        }

        .checkout-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .form-group label {
          font-size: 13px;
          font-weight: 600;
          color: #333;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .form-group input,
        .form-group select {
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
          font-family: inherit;
          transition: border-color 0.2s;
        }

        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: #ff6b35;
          box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.1);
        }

        .checkout-button {
          padding: 14px;
          background: linear-gradient(135deg, #ff6b35 0%, #ff8c42 100%);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 10px;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .checkout-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(255, 107, 53, 0.3);
        }

        .checkout-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 600px) {
          .checkout-card {
            padding: 30px 20px;
          }

          .form-row {
            grid-template-columns: 1fr;
          }

          .checkout-header h1 {
            font-size: 24px;
          }
        }
      `}</style>
    </div>
  );
}