// ==========================================================================
// CLAY MOCK E-COMMERCE STOREFRONT COMPONENT
// ==========================================================================

import React, { useState, useEffect } from 'https://esm.sh/react@18.2.0';
import { 
  ShoppingBag, 
  ShoppingCart, 
  ArrowLeft, 
  Plus, 
  Minus, 
  Trash2, 
  CheckCircle2, 
  ChevronRight, 
  Sparkles, 
  Heart 
} from 'https://esm.sh/lucide-react@0.263.0';
import { trackPageView, trackEvent } from './tracker.js';

// Mock Product Database
export const PRODUCTS = [
  {
    id: 'gadget-1',
    name: 'Clay-Kit 3D Keyboard',
    price: 280,
    category: 'Tech',
    emoji: '⌨️',
    rating: '4.9',
    description: 'Custom mechanical keyboard with hand-sculpted claymation keycaps and hot-swappable tactile switches. Playful yet highly functional B2B office equipment.'
  },
  {
    id: 'gadget-2',
    name: 'Mascot Ceramic Mug',
    price: 35,
    category: 'Merch',
    emoji: '☕',
    rating: '4.8',
    description: 'Double-walled ceramic mug featuring Clay\'s signature mountain and mascot relief details. Keep your coffee warm on your cream-tinted white canvas desk.'
  },
  {
    id: 'gadget-3',
    name: 'Claymotion Sketchbook',
    price: 24,
    category: 'Stationary',
    emoji: '📓',
    rating: '4.7',
    description: 'Saturated peach-colored hardcover sketchbook with 200gsm warm cream-tinted pages. The perfect place to draft your next growth sequencer ideas.'
  },
  {
    id: 'gadget-4',
    name: 'Abstract 3D Desktop Mascot',
    price: 450,
    category: 'Art',
    emoji: '🗿',
    rating: '5.0',
    description: 'Limited edition physical claymation sculpture rendered in high-grade resin. Gives your office setting maximum branding voltage and creative inspiration.'
  }
];

export default function Storefront({ cart, setCart, currentView, setCurrentView, selectedProduct, setSelectedProduct }) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Track Page Views when navigation changes
  useEffect(() => {
    let url = '/home';
    if (currentView === 'CATEGORY') url = '/category';
    if (currentView === 'PRODUCT_DETAIL' && selectedProduct) url = `/product/${selectedProduct.id}`;
    if (currentView === 'CART') url = '/cart';
    if (currentView === 'CHECKOUT') url = '/checkout';
    if (currentView === 'PURCHASE') url = '/purchase-success';
    
    trackPageView(currentView, url, selectedProduct ? { productId: selectedProduct.id } : {});
  }, [currentView, selectedProduct]);

  // Handle Page view transitions
  const navigateTo = (view, product = null) => {
    setSelectedProduct(product);
    setCurrentView(view);
  };

  // Cart operations
  const addToCart = (product) => {
    setCart(prevCart => {
      const existing = prevCart.find(item => item.product.id === product.id);
      if (existing) {
        return prevCart.map(item => 
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { product, quantity: 1 }];
    });

    trackEvent('ADD_TO_CART', currentView, 'add-to-cart-btn', { 
      productId: product.id, 
      price: product.price 
    });
  };

  const updateQuantity = (productId, amount) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.product.id === productId) {
          const newQty = item.quantity + amount;
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
    
    trackEvent('CLICK', currentView, amount > 0 ? 'increase-qty-btn' : 'decrease-qty-btn', { productId });
  };

  const removeFromCart = (productId) => {
    setCart(prevCart => prevCart.filter(item => item.product.id !== productId));
    trackEvent('CLICK', currentView, 'remove-item-btn', { productId });
  };

  const getCartTotal = () => {
    return cart.reduce((acc, curr) => acc + (curr.product.price * curr.quantity), 0);
  };

  // Simulated Checkout Submission
  const handleCheckoutSubmit = (e) => {
    e.preventDefault();
    const orderId = 'ord_' + Math.random().toString(36).substring(2, 8);
    const total = getCartTotal();

    trackEvent('PURCHASE', currentView, 'pay-now-btn', { 
      orderId, 
      revenue: total 
    });

    setCart([]);
    navigateTo('PURCHASE');
  };

  // Filter products by category
  const filteredProducts = selectedCategory === 'All' 
    ? PRODUCTS 
    : PRODUCTS.filter(p => p.category === selectedCategory);

  return (
    <div className="store-pane">
      {/* Mock Store Header */}
      <header className="store-header">
        <div className="store-logo" onClick={() => navigateTo('HOME')}>
          <span>🛍️</span>
          <span>ClayStore</span>
        </div>
        <nav className="store-nav">
          <span className={`store-nav-link ${currentView === 'HOME' ? 'active' : ''}`} onClick={() => navigateTo('HOME')}>Home</span>
          <span className={`store-nav-link ${currentView === 'CATEGORY' ? 'active' : ''}`} onClick={() => navigateTo('CATEGORY')}>Catalog</span>
        </nav>
        <div className="store-cart-trigger" onClick={() => navigateTo('CART')}>
          <ShoppingCart size={20} color="var(--colors-ink)" />
          <span className="title-sm" style={{color: 'var(--colors-ink)'}}>Cart</span>
          {cart.length > 0 && (
            <span className="cart-count-badge">
              {cart.reduce((acc, curr) => acc + curr.quantity, 0)}
            </span>
          )}
        </div>
      </header>

      {/* --- 1. HOME VIEW --- */}
      {currentView === 'HOME' && (
        <>
          <section className="store-hero">
            <div className="store-hero-left">
              <span className="badge-pill-main">✨ SPECIAL CURATION</span>
              <h1 className="display-md" style={{fontWeight: 500}}>Playful design meets data-driven workspace.</h1>
              <p className="body-md" style={{color: 'var(--colors-body)', maxWidth: '460px'}}>
                Explore our hand-crafted, claymation physical office assets engineered for maximum aesthetic voltage.
              </p>
              <div style={{marginTop: '12px'}}>
                <button className="btn btn-primary" onClick={() => {
                  trackEvent('CLICK', 'HOME', 'browse-catalog-hero-btn');
                  navigateTo('CATEGORY');
                }}>
                  Browse Catalog <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div className="store-hero-right">
              <div className="clay-scene-illustration">
                <span className="clay-mascot-face">🧸</span>
              </div>
            </div>
          </section>

          <section style={{display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)'}}>
            <h2 className="title-lg">Featured Collections</h2>
            <div className="product-grid">
              {PRODUCTS.slice(0, 2).map(product => (
                <div key={product.id} className="product-card" onClick={() => navigateTo('PRODUCT_DETAIL', product)}>
                  <div className="product-card-img-placeholder">
                    {product.emoji}
                  </div>
                  <div className="flex-row-between">
                    <span className="caption-uppercase" style={{color: 'var(--colors-muted)'}}>{product.category}</span>
                    <span className="caption" style={{color: 'var(--colors-brand-ochre)'}}>★ {product.rating}</span>
                  </div>
                  <h3 className="title-sm">{product.name}</h3>
                  <div className="flex-row-between" style={{marginTop: 'auto', paddingTop: '8px'}}>
                    <span className="product-card-price">${product.price}</span>
                    <button className="btn btn-secondary btn-sm" onClick={(e) => {
                      e.stopPropagation();
                      addToCart(product);
                    }}>+ Add</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* --- 2. CATALOG CATEGORY VIEW --- */}
      {currentView === 'CATEGORY' && (
        <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)'}}>
          <div>
            <h2 className="display-sm" style={{marginBottom: '8px'}}>The Claymation Catalog</h2>
            <p className="body-sm" style={{color: 'var(--colors-muted)'}}>Filter by our signature collections to find your perfect desk artifacts.</p>
          </div>

          <div className="category-filters">
            {['All', 'Tech', 'Merch', 'Stationary', 'Art'].map(cat => (
              <button 
                key={cat} 
                className={`category-filter-tab ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => {
                  trackEvent('CLICK', 'CATEGORY', `filter-tab-${cat.toLowerCase()}`);
                  setSelectedCategory(cat);
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="product-grid">
            {filteredProducts.map(product => (
              <div key={product.id} className="product-card" onClick={() => navigateTo('PRODUCT_DETAIL', product)}>
                <div className="product-card-img-placeholder">
                  {product.emoji}
                </div>
                <div className="flex-row-between">
                  <span className="caption-uppercase" style={{color: 'var(--colors-muted)'}}>{product.category}</span>
                  <span className="caption" style={{color: 'var(--colors-brand-ochre)'}}>★ {product.rating}</span>
                </div>
                <h3 className="title-sm">{product.name}</h3>
                <div className="flex-row-between" style={{marginTop: 'auto', paddingTop: '8px'}}>
                  <span className="product-card-price">${product.price}</span>
                  <button className="btn btn-secondary btn-sm" onClick={(e) => {
                    e.stopPropagation();
                    addToCart(product);
                  }}>+ Add</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- 3. PRODUCT DETAIL VIEW --- */}
      {currentView === 'PRODUCT_DETAIL' && selectedProduct && (
        <div>
          <button className="btn btn-text-link" style={{marginBottom: 'var(--spacing-lg)', paddingLeft: 0}} onClick={() => navigateTo('CATEGORY')}>
            <ArrowLeft size={16} /> Back to Catalog
          </button>
          
          <div className="product-detail-layout">
            <div className="product-detail-img">
              {selectedProduct.emoji}
            </div>
            <div className="product-detail-info">
              <div className="product-tags">
                <span className="product-tag">{selectedProduct.category}</span>
                <span className="product-tag" style={{color: 'var(--colors-brand-ochre)'}}>★ {selectedProduct.rating} Rating</span>
              </div>
              <h2 className="display-sm" style={{fontWeight: 500}}>{selectedProduct.name}</h2>
              <span className="display-sm" style={{fontWeight: 600, color: 'var(--colors-primary)'}}>${selectedProduct.price}</span>
              <p className="body-md" style={{color: 'var(--colors-body)'}}>{selectedProduct.description}</p>
              
              <div style={{display: 'flex', gap: 'var(--spacing-md)', marginTop: '12px'}}>
                <button className="btn btn-primary" style={{flex: 1}} onClick={() => addToCart(selectedProduct)}>
                  <ShoppingCart size={18} /> Add to Cart
                </button>
                <button className="btn btn-secondary" onClick={() => {
                  trackEvent('CLICK', 'PRODUCT_DETAIL', 'favorite-heart-btn', { productId: selectedProduct.id });
                }}>
                  <Heart size={18} color="var(--colors-brand-pink)" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- 4. CART VIEW --- */}
      {currentView === 'CART' && (
        <div>
          <h2 className="display-sm" style={{marginBottom: 'var(--spacing-lg)'}}>Your Cart</h2>
          
          {cart.length === 0 ? (
            <div style={{textAlign: 'center', padding: '48px 0'}}>
              <span style={{fontSize: '60px'}}>🛒</span>
              <h3 className="title-md" style={{margin: '16px 0'}}>Your shopping cart is empty</h3>
              <button className="btn btn-primary" onClick={() => navigateTo('CATEGORY')}>Start Shopping</button>
            </div>
          ) : (
            <div className="cart-layout">
              <div className="cart-items-list">
                {cart.map(item => (
                  <div key={item.product.id} className="cart-item-row">
                    <div className="cart-item-img">{item.product.emoji}</div>
                    <div>
                      <h4 className="title-sm">{item.product.name}</h4>
                      <span className="caption" style={{color: 'var(--colors-muted)'}}>${item.product.price} each</span>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                      <button className="btn btn-secondary btn-sm" style={{width: 24, height: 24, padding: 0}} onClick={() => updateQuantity(item.product.id, -1)}><Minus size={12} /></button>
                      <span className="title-sm">{item.quantity}</span>
                      <button className="btn btn-secondary btn-sm" style={{width: 24, height: 24, padding: 0}} onClick={() => updateQuantity(item.product.id, 1)}><Plus size={12} /></button>
                    </div>
                    <button className="btn btn-text-link" style={{color: 'var(--colors-error)'}} onClick={() => removeFromCart(item.product.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="cart-summary-card">
                <h3 className="title-md">Summary</h3>
                <div className="flex-row-between">
                  <span className="body-sm">Subtotal</span>
                  <span className="title-sm">${getCartTotal()}</span>
                </div>
                <div className="flex-row-between">
                  <span className="body-sm">Shipping</span>
                  <span className="caption" style={{color: 'var(--colors-success)'}}>FREE</span>
                </div>
                <hr style={{border: 'none', borderBottom: '1px solid var(--colors-hairline)'}} />
                <div className="flex-row-between">
                  <span className="title-sm">Total</span>
                  <span className="title-lg" style={{color: 'var(--colors-primary)'}}>${getCartTotal()}</span>
                </div>
                <button className="btn btn-primary" style={{width: '100%', marginTop: '12px'}} onClick={() => navigateTo('CHECKOUT')}>
                  Proceed to Checkout <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- 5. CHECKOUT VIEW --- */}
      {currentView === 'CHECKOUT' && (
        <div style={{maxWidth: '700px', margin: '0 auto'}}>
          <h2 className="display-sm" style={{marginBottom: 'var(--spacing-lg)'}}>Payment Details</h2>
          <form className="cart-summary-card" style={{backgroundColor: 'var(--colors-canvas)', border: '1px solid var(--colors-hairline)'}} onSubmit={handleCheckoutSubmit}>
            <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)'}}>
              <label className="title-sm">Email Address</label>
              <input type="email" required className="text-input" placeholder="you@clay.com" />
            </div>
            
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)'}}>
              <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)'}}>
                <label className="title-sm">First Name</label>
                <input type="text" required className="text-input" placeholder="Jane" />
              </div>
              <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)'}}>
                <label className="title-sm">Last Name</label>
                <input type="text" required className="text-input" placeholder="Doe" />
              </div>
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)'}}>
              <label className="title-sm">Credit Card</label>
              <input type="text" required className="text-input" placeholder="••••  ••••  ••••  1234" />
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)'}}>
              <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)'}}>
                <label className="title-sm">Expiry</label>
                <input type="text" required className="text-input" placeholder="MM / YY" />
              </div>
              <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)'}}>
                <label className="title-sm">CVV</label>
                <input type="text" required className="text-input" placeholder="123" />
              </div>
            </div>

            <div style={{marginTop: '12px', borderTop: '1px solid var(--colors-hairline)', paddingTop: '16px'}}>
              <div className="flex-row-between" style={{marginBottom: '16px'}}>
                <span className="title-sm">Amount Due</span>
                <span className="title-lg" style={{color: 'var(--colors-primary)'}}>${getCartTotal()}</span>
              </div>
              <button type="submit" className="btn btn-primary" style={{width: '100%'}}>
                Pay Now
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- 6. PURCHASE VIEW --- */}
      {currentView === 'PURCHASE' && (
        <div className="checkout-completed-card">
          <div className="success-icon-badge">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="display-sm" style={{fontWeight: 500}}>Purchase Completed!</h2>
          <p className="body-md" style={{color: 'var(--colors-body)', maxWidth: '400px'}}>
            Your mock order has been logged to the analytical database. Watch the conversions tick up in the dashboard right now!
          </p>
          <button className="btn btn-primary" onClick={() => navigateTo('HOME')}>Continue Shopping</button>
        </div>
      )}
    </div>
  );
}
