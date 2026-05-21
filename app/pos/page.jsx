'use client';

import { useState, useEffect } from 'react';
import { ModuleGate } from '@/components/ModuleGate';

export default function POSPage() {
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderTotal, setOrderTotal] = useState(0);
  const [notice, setNotice] = useState(null);

  // Load menu items from database
  useEffect(() => {
    const loadMenu = async () => {
      try {
        const response = await fetch('/api/pos/menu-items');
        const items = await response.json();
        setMenuItems(items);
      } catch (error) {
        console.error('Failed to load menu:', error);
        // Fallback menu for offline
        setMenuItems([
          { id: 1, name: 'Tacos (3)', price: 12.00 },
          { id: 2, name: 'Burrito', price: 10.00 },
          { id: 3, name: 'Quesadilla', price: 9.00 },
          { id: 4, name: 'Rice & Beans', price: 5.00 },
          { id: 5, name: 'Agua Fresca', price: 3.00 },
          { id: 6, name: 'Churros (3)', price: 5.00 },
        ]);
      }
    };
    loadMenu();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const order = params.get('order');

    if (payment === 'success') {
      setNotice({
        type: 'success',
        message: order
          ? `Payment complete. POS order ${order.slice(0, 8)} was marked paid and inventory deductions will run from recipe mappings.`
          : 'Payment complete. If no order was stored, run the POS Supabase setup to enable inventory tracking.',
      });
      setCart([]);
    }

    if (payment === 'cancelled') {
      setNotice({ type: 'warning', message: 'Payment was cancelled. The cart is still available to retry checkout.' });
    }
  }, []);

  // Update total when cart changes
  useEffect(() => {
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    setOrderTotal(total);
  }, [cart]);

  // Add item to cart
  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  // Remove item from cart
  const removeFromCart = (itemId) => {
    setCart((prev) => prev.filter((i) => i.id !== itemId));
  };

  // Update quantity
  const updateQuantity = (itemId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
    } else {
      setCart((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, quantity } : i))
      );
    }
  };

  // Process payment
  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('Cart is empty');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          customerName,
          orderSource: 'food_truck',
          total: Math.round(orderTotal * 100), // Convert to cents
        }),
      });

      if (!response.ok) throw new Error('Failed to create checkout session');
      const { url, warning } = await response.json();
      if (warning) console.warn(warning);
      window.location.href = url;
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Payment failed. Please try again.');
      setLoading(false);
    }
  };

  // Clear cart
  const clearCart = () => {
    if (confirm('Clear cart?')) {
      setCart([]);
    }
  };

  return (
    <ModuleGate moduleKey="pos">
    <div className="pos-container">
      <header className="pos-header">
        <div>
          <h1>Food Truck POS</h1>
          <p>Stripe Checkout orders tie back to POS history and mapped inventory recipes.</p>
        </div>
        <div className="total-display">
          Total: <span className="amount">${orderTotal.toFixed(2)}</span>
        </div>
      </header>

      {notice && (
        <div className={`notice ${notice.type}`}>
          <span>{notice.message}</span>
          <button onClick={() => setNotice(null)}>Dismiss</button>
        </div>
      )}

      <main className="pos-main">
        {/* Menu Grid */}
        <section className="menu-section">
          <h2>Menu Items</h2>
          <div className="menu-grid">
            {menuItems.map((item) => (
              <button
                key={item.id}
                className="menu-item"
                onClick={() => addToCart(item)}
              >
                <div className="item-name">{item.name}</div>
                <div className="item-price">${item.price.toFixed(2)}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Cart */}
        <section className="cart-section">
          <h2>Order</h2>
          <label className="customer-label" htmlFor="customerName">Customer name / ticket</label>
          <input
            id="customerName"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            className="customer-input"
            placeholder="Walk-up customer, name, or ticket #"
          />
          {cart.length === 0 ? (
            <p className="empty-cart">Cart is empty</p>
          ) : (
            <>
              <div className="cart-items">
                {cart.map((item) => (
                  <div key={item.id} className="cart-item">
                    <div className="item-info">
                      <span className="name">{item.name}</span>
                      <span className="subtotal">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                    <div className="quantity-controls">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="qty-btn"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          updateQuantity(item.id, parseInt(e.target.value) || 1)
                        }
                        className="qty-input"
                      />
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="qty-btn"
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="remove-btn"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="cart-footer">
                <div className="total-line">
                  <span>Total:</span>
                  <span className="total-amount">${orderTotal.toFixed(2)}</span>
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={loading}
                  className="pay-button"
                >
                  {loading ? 'Opening Stripe...' : 'Pay with Stripe'}
                </button>
                <p className="payment-note">
                  Card information is processed by Stripe and is not stored in GizOps. Inventory deducts after successful Stripe payment when menu recipes are mapped.
                </p>
                <button onClick={clearCart} className="clear-button">
                  Clear Order
                </button>
              </div>
            </>
          )}
        </section>
      </main>

      <style jsx>{`
        .pos-container {
          min-height: 100vh;
          background: #f5f5f5;
          display: flex;
          flex-direction: column;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .pos-header {
          background: linear-gradient(135deg, #ff6b35 0%, #ff8c42 100%);
          color: white;
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .pos-header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }

        .pos-header p {
          margin: 4px 0 0;
          font-size: 13px;
          opacity: 0.85;
        }

        .notice {
          margin: 16px 20px 0;
          border-radius: 8px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          font-size: 13px;
          font-weight: 600;
        }

        .notice.success {
          background: #ecfdf3;
          border: 1px solid #86efac;
          color: #166534;
        }

        .notice.warning {
          background: #fffbeb;
          border: 1px solid #fcd34d;
          color: #92400e;
        }

        .notice button {
          border: none;
          background: transparent;
          color: inherit;
          cursor: pointer;
          font-weight: 700;
        }

        .total-display {
          font-size: 18px;
          font-weight: 600;
        }

        .total-display .amount {
          font-size: 24px;
          margin-left: 8px;
        }

        .pos-main {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 20px;
          padding: 20px;
          flex: 1;
          overflow: hidden;
        }

        .menu-section,
        .cart-section {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
          display: flex;
          flex-direction: column;
        }

        .menu-section h2,
        .cart-section h2 {
          margin: 0 0 15px 0;
          font-size: 20px;
          color: #333;
        }

        .customer-label {
          font-size: 12px;
          font-weight: 700;
          color: #555;
          margin-bottom: 6px;
          text-transform: uppercase;
        }

        .customer-input {
          border: 1px solid #ddd;
          border-radius: 6px;
          padding: 11px 12px;
          font-size: 14px;
          margin-bottom: 14px;
        }

        .customer-input:focus {
          outline: none;
          border-color: #ff6b35;
          box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.12);
        }

        .menu-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px;
          flex: 1;
          overflow-y: auto;
        }

        .menu-item {
          background: #f9f9f9;
          border: 2px solid #eee;
          border-radius: 8px;
          padding: 15px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
          text-align: center;
        }

        .menu-item:hover {
          background: #fff;
          border-color: #ff6b35;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(255, 107, 53, 0.2);
        }

        .item-name {
          font-weight: 600;
          margin-bottom: 8px;
          color: #333;
        }

        .item-price {
          color: #ff6b35;
          font-weight: 700;
          font-size: 16px;
        }

        .cart-items {
          flex: 1;
          overflow-y: auto;
          margin-bottom: 15px;
          border-bottom: 1px solid #eee;
          padding-bottom: 15px;
        }

        .cart-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #f0f0f0;
        }

        .item-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }

        .item-info .name {
          font-weight: 600;
          color: #333;
          font-size: 14px;
        }

        .item-info .subtotal {
          color: #ff6b35;
          font-weight: 700;
          font-size: 14px;
        }

        .quantity-controls {
          display: flex;
          gap: 6px;
          align-items: center;
        }

        .qty-btn,
        .remove-btn {
          width: 28px;
          height: 28px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }

        .qty-btn:hover {
          background: #ff6b35;
          color: white;
          border-color: #ff6b35;
        }

        .qty-input {
          width: 40px;
          height: 28px;
          border: 1px solid #ddd;
          border-radius: 4px;
          text-align: center;
          font-weight: 600;
        }

        .remove-btn {
          background: #ffebee;
          color: #d32f2f;
          border-color: #ffcdd2;
        }

        .remove-btn:hover {
          background: #d32f2f;
          color: white;
        }

        .empty-cart {
          text-align: center;
          color: #999;
          padding: 40px 20px;
          font-size: 14px;
        }

        .cart-footer {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .total-line {
          display: flex;
          justify-content: space-between;
          font-size: 16px;
          font-weight: 600;
          color: #333;
          padding: 12px 0;
          border-top: 2px solid #ff6b35;
        }

        .total-amount {
          color: #ff6b35;
          font-size: 20px;
        }

        .pay-button,
        .clear-button {
          padding: 14px;
          border: none;
          border-radius: 6px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .pay-button {
          background: linear-gradient(135deg, #ff6b35 0%, #ff8c42 100%);
          color: white;
        }

        .pay-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(255, 107, 53, 0.3);
        }

        .pay-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .clear-button {
          background: #f5f5f5;
          color: #666;
          border: 1px solid #ddd;
        }

        .clear-button:hover {
          background: #efefef;
        }

        .payment-note {
          margin: -2px 0 2px;
          padding: 10px;
          border-radius: 6px;
          background: #fff7ed;
          border: 1px solid #fed7aa;
          color: #7c2d12;
          font-size: 12px;
          line-height: 1.4;
        }

        @media (max-width: 900px) {
          .pos-main {
            grid-template-columns: 1fr;
          }

          .menu-grid {
            grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
          }
        }
      `}</style>
    </div>
    </ModuleGate>
  );
}
