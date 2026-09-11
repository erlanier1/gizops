'use client';

import { useState, useEffect } from 'react';
import { ModuleGate } from '@/components/ModuleGate';
import { useAccountScope } from '@/lib/account-scope';
import { useUser } from '@/lib/auth-context';

function uniqueMenuItems(items) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const key = `${String(item.name || '').trim().toLowerCase()}|${String(item.category || '').trim().toLowerCase()}|${Number(item.price).toFixed(2)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function POSPage() {
  const { selectedAccountId } = useAccountScope();
  const { canEdit } = useUser();
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderTotal, setOrderTotal] = useState(0);
  const [notice, setNotice] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [itemForm, setItemForm] = useState({ name: '', category: 'Entrees', price: '' });

  // Load menu items from database
  useEffect(() => {
    const loadMenu = async () => {
      try {
        if (!selectedAccountId) { setMenuItems([]); return; }
        const response = await fetch(`/api/pos/menu-items?accountId=${encodeURIComponent(selectedAccountId)}`);
        const items = await response.json();
        setMenuItems(uniqueMenuItems(items));
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
  }, [selectedAccountId]);

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
    if (!selectedAccountId) {
      alert('Choose a company workspace before starting checkout.');
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
          accountId: selectedAccountId,
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

  const openItemForm = (item = null) => {
    setEditingItem(item);
    setItemForm(item
      ? { name: item.name, category: item.category || 'Entrees', price: String(item.price) }
      : { name: '', category: 'Entrees', price: '' });
    setShowItemForm(true);
  };

  const saveMenuItem = async (event) => {
    event.preventDefault();
    setSavingItem(true);
    try {
      const response = await fetch('/api/pos/menu-items', {
        method: editingItem ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...itemForm, id: editingItem?.id, accountId: selectedAccountId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save item.');
      setMenuItems((items) => editingItem ? items.map((item) => item.id === result.id ? result : item) : [...items, result]);
      if (editingItem) setCart((items) => items.map((item) => item.id === result.id ? { ...item, ...result } : item));
      setShowItemForm(false);
      setNotice({ type: 'success', message: editingItem ? `${result.name} was updated.` : `${result.name} was added to the POS.` });
    } catch (error) {
      setNotice({ type: 'warning', message: error.message });
    } finally {
      setSavingItem(false);
    }
  };

  const removeMenuItem = async (item) => {
    if (!confirm(`Remove ${item.name} from the POS menu?`)) return;
    try {
      const response = await fetch('/api/pos/menu-items', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, accountId: selectedAccountId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not remove item.');
      setMenuItems((items) => items.filter((entry) => entry.id !== item.id));
      setCart((items) => items.filter((entry) => entry.id !== item.id));
      setNotice({ type: 'success', message: `${item.name} was removed from the POS.` });
    } catch (error) {
      setNotice({ type: 'warning', message: error.message });
    }
  };

  return (
    <ModuleGate moduleKey="pos">
    <div className="pos-container">
      <header className="pos-header">
        <div>
          <h1>Food Truck POS</h1>
          <p>PayPal Checkout orders tie back to POS history and mapped inventory recipes.</p>
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
          <div className="menu-heading">
            <h2>Menu Items</h2>
            {canEdit && <button className="manage-button" onClick={() => openItemForm()}>+ Add Item</button>}
          </div>
          {showItemForm && (
            <form className="item-form" onSubmit={saveMenuItem}>
              <h3>{editingItem ? 'Edit menu item' : 'Add menu item'}</h3>
              <input aria-label="Item name" required maxLength={80} placeholder="Item name" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} />
              <input aria-label="Category" required maxLength={50} placeholder="Category" value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })} />
              <input aria-label="Price" required type="number" min="0" step="0.01" placeholder="Price" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} />
              <div className="form-actions">
                <button type="button" onClick={() => setShowItemForm(false)}>Cancel</button>
                <button type="submit" disabled={savingItem}>{savingItem ? 'Saving...' : 'Save Item'}</button>
              </div>
            </form>
          )}
          <div className="menu-grid">
            {menuItems.map((item) => (
              <div key={item.id} className="menu-item-wrap">
                <button className="menu-item" onClick={() => addToCart(item)}>
                  <div className="item-name">{item.name}</div>
                  <div className="item-category">{item.category || 'Menu'}</div>
                  <div className="item-price">${Number(item.price).toFixed(2)}</div>
                </button>
                {canEdit && <div className="item-actions">
                  <button onClick={() => openItemForm(item)}>Edit</button>
                  <button className="delete" onClick={() => removeMenuItem(item)}>Remove</button>
                </div>}
              </div>
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
                  {loading ? 'Opening PayPal...' : 'Pay with PayPal'}
                </button>
                <p className="payment-note">
                  Card information is processed by PayPal and is not stored in GizOps. Inventory deducts after successful PayPal payment when menu recipes are mapped.
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
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
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
          min-width: 0;
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

        .menu-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .manage-button { border: 0; border-radius: 6px; background: #ff6b35; color: white; padding: 9px 13px; font-weight: 700; cursor: pointer; }
        .item-form { display: grid; grid-template-columns: 2fr 1fr 110px; gap: 8px; padding: 14px; margin-bottom: 14px; border: 1px solid #fed7aa; border-radius: 8px; background: #fff7ed; }
        .item-form h3 { grid-column: 1 / -1; margin: 0 0 4px; color: #333; font-size: 15px; }
        .item-form input { min-width: 0; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; }
        .form-actions { grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 8px; }
        .form-actions button { border: 1px solid #ddd; border-radius: 6px; background: white; padding: 8px 12px; cursor: pointer; font-weight: 600; }
        .form-actions button[type='submit'] { border-color: #ff6b35; background: #ff6b35; color: white; }
        .menu-item-wrap { display: flex; flex-direction: column; min-width: 0; }
        .menu-item-wrap .menu-item { width: 100%; flex: 1; }
        .item-category { margin: -3px 0 7px; color: #777; font-size: 11px; }
        .item-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 5px; }
        .item-actions button { border: 1px solid #ddd; border-radius: 5px; background: white; padding: 6px; color: #555; cursor: pointer; font-size: 11px; font-weight: 700; }
        .item-actions .delete { color: #b91c1c; }

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
          .pos-container { min-height: auto; }
          .pos-header { align-items: flex-start; gap: 12px; padding: 16px; }
          .pos-header h1 { font-size: 23px; }
          .total-display { flex-shrink: 0; font-size: 14px; }
          .total-display .amount { display: block; margin-left: 0; font-size: 20px; }
          .pos-main {
            grid-template-columns: minmax(0, 1fr);
            overflow: visible;
            padding: 12px;
            gap: 12px;
          }

          .menu-section, .cart-section { min-width: 0; padding: 14px; }

          .menu-grid {
            grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
          }
          .item-form { grid-template-columns: 1fr; }
          .item-form h3, .form-actions { grid-column: 1; }
        }
      `}</style>
    </div>
    </ModuleGate>
  );
}
