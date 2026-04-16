'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function CheckoutSuccess() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  return (
    <div className="success-container">
      <div className="success-card">
        <div className="success-icon">✓</div>
        <h1>Deposit Confirmed!</h1>
        <p>Your catering deposit has been successfully processed.</p>
        
        <div className="info-box">
          <p>Session ID: <code>{sessionId}</code></p>
          <p>A confirmation email has been sent to you.</p>
        </div>

        <div className="next-steps">
          <h2>What's Next?</h2>
          <ul>
            <li>We'll contact you within 24 hours to finalize details</li>
            <li>Balance will be due 7 days before your event</li>
            <li>Check your email for the full invoice</li>
          </ul>
        </div>

        <Link href="/dashboard" className="back-button">
          Back to Dashboard
        </Link>
      </div>

      <style jsx>{`
        .success-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .success-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          max-width: 500px;
          width: 100%;
          padding: 40px;
          text-align: center;
        }

        .success-icon {
          width: 60px;
          height: 60px;
          background: #4caf50;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          margin: 0 auto 20px;
          animation: scaleIn 0.5s ease-out;
        }

        @keyframes scaleIn {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        .success-card h1 {
          font-size: 28px;
          font-weight: 700;
          color: #1a1a1a;
          margin: 0 0 10px 0;
        }

        .success-card > p {
          color: #666;
          font-size: 15px;
          margin: 0 0 30px 0;
        }

        .info-box {
          background: #f5f5f5;
          border-left: 4px solid #ff6b35;
          padding: 15px;
          border-radius: 6px;
          margin-bottom: 30px;
          text-align: left;
        }

        .info-box p {
          margin: 8px 0;
          font-size: 13px;
          color: #333;
        }

        .info-box code {
          background: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
          color: #ff6b35;
          font-size: 12px;
        }

        .next-steps {
          text-align: left;
          margin-bottom: 30px;
        }

        .next-steps h2 {
          font-size: 16px;
          font-weight: 600;
          color: #1a1a1a;
          margin: 0 0 15px 0;
        }

        .next-steps ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .next-steps li {
          padding: 8px 0;
          padding-left: 24px;
          position: relative;
          color: #555;
          font-size: 14px;
        }

        .next-steps li:before {
          content: '→';
          position: absolute;
          left: 0;
          color: #ff6b35;
          font-weight: bold;
        }

        .back-button {
          display: inline-block;
          padding: 14px 30px;
          background: linear-gradient(135deg, #ff6b35 0%, #ff8c42 100%);
          color: white;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .back-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(255, 107, 53, 0.3);
        }
      `}</style>
    </div>
  );
}
