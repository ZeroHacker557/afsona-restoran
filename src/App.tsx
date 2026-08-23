import { BottomNav } from './components/layout/BottomNav'
import { SearchOverlay } from './components/layout/SearchOverlay'
import { CartDrawer } from './components/cart/CartDrawer'
import { Toast } from './components/ui/Toast'
import { CheckoutSuccess } from './components/ui/CheckoutSuccess'
import { useShopStore } from './hooks/use-shop-store'
import { CatalogPage } from './pages/CatalogPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { FavoritesPage } from './pages/FavoritesPage'
import { HomePage } from './pages/HomePage'
import { OrdersPage } from './pages/OrdersPage'
import { ProductDetailPage } from './pages/ProductDetailPage'
import { ProfilePage } from './pages/ProfilePage'
import { AddressesPage } from './pages/AddressesPage'
import { ProfileEditPage } from './pages/ProfileEditPage'
import { ReviewsPage } from './pages/ReviewsPage'
import { NotificationsPage } from './pages/NotificationsPage'

function App() {
  const shop = useShopStore()
  const productActions = {
    onOpen: shop.openProduct,
    onAddToCart: shop.addToCart,
    likedIds: shop.likedIds,
    onToggleLike: shop.toggleLike,
  }

  return (
    <main className="app-shell">
      <div className="app-container">
        {/* Search Overlay */}
        {shop.isSearchOpen && (
          <SearchOverlay
            query={shop.query}
            results={shop.searchResults}
            onQueryChange={shop.setQuery}
            onClose={() => shop.setSearchOpen(false)}
            onOpenProduct={shop.openProduct}
          />
        )}

        {/* Cart Drawer */}
        {shop.isCartOpen && (
          <CartDrawer
            cartProducts={shop.cartProducts}
            cartTotal={shop.cartTotal}
            onClose={shop.closeCart}
            onUpdateQuantity={shop.updateCartQuantity}
            onCheckout={shop.goToCheckout}
          />
        )}

        {/* Toast Notification */}
        {shop.toast && <Toast message={shop.toast} onClose={shop.clearToast} />}

        {/* Checkout Success Modal */}
        {shop.checkoutDone && <CheckoutSuccess onViewOrders={() => shop.navigate('orders')} />}

        {/* Pages */}
        <div className="page-wrapper">
          {shop.page === 'home' && (
            <div className="page-animate">
              <HomePage
                products={shop.products}
                categories={shop.categories}
                loading={shop.loading}
                {...productActions}
                cartCount={shop.cartCount}
                unreadNotificationsCount={shop.unreadNotificationsCount}
                onSearch={() => shop.setSearchOpen(true)}
                onNavigate={shop.navigate}
                onOpenCart={shop.openCart}
                onNotify={shop.notify}
              />
            </div>
          )}
          {shop.page === 'catalog' && (
            <div className="page-animate">
              <CatalogPage
                products={shop.products}
                categories={shop.categories}
                loading={shop.loading}
                {...productActions}
                cartCount={shop.cartCount}
                onSearch={() => shop.setSearchOpen(true)}
                onOpenCart={shop.openCart}
              />
            </div>
          )}
          {shop.page === 'favorites' && (
            <div className="page-animate">
              <FavoritesPage
                products={shop.products}
                {...productActions}
                cartCount={shop.cartCount}
                onOpenCart={shop.openCart}
              />
            </div>
          )}
          {shop.page === 'orders' && (
            <div className="page-animate">
              <OrdersPage
                orders={shop.myOrders}
                authReady={shop.authReady}
                isAuthenticated={shop.isAuthenticated}
                cartCount={shop.cartCount}
                onSearch={() => shop.setSearchOpen(true)}
                onOpenCart={shop.openCart}
              />
            </div>
          )}
          {shop.page === 'profile' && (
            <div className="page-animate">
              <ProfilePage
                profile={shop.userProfile}
                orders={shop.myOrders}
                onNavigate={shop.navigate}
                onNotify={shop.notify}
              />
            </div>
          )}
          {shop.page === 'detail' && shop.selectedProduct && (
            <ProductDetailPage
              product={shop.selectedProduct}
              onAddToCart={(product, size, color) => shop.addToCart(product, size, color)}
              onBack={() => shop.navigate('catalog')}
              likedIds={shop.likedIds}
              onToggleLike={shop.toggleLike}
              onOpenCart={shop.openCart}
              cartCount={shop.cartCount}
            />
          )}
          {shop.page === 'checkout' && (
            <CheckoutPage
              profile={shop.userProfile}
              cartProducts={shop.cartProducts}
              cartTotal={shop.cartTotal}
              orderForm={shop.orderForm}
              onUpdateForm={shop.updateOrderForm}
              onSubmit={shop.submitOrder}
              isSubmitting={shop.isSubmitting}
              onBack={() => shop.navigate('catalog')}
              onNavigate={shop.navigate}
            />
          )}
          {shop.page === 'addresses' && (
            <div className="page-animate">
              <AddressesPage
                profile={shop.userProfile}
                onNavigate={shop.navigate}
                onNotify={shop.notify}
              />
            </div>
          )}
          {shop.page === 'profile_edit' && (
            <div className="page-animate">
              <ProfileEditPage
                profile={shop.userProfile}
                onNavigate={shop.navigate}
                onNotify={shop.notify}
              />
            </div>
          )}
          {shop.page === 'reviews' && (
            <div className="page-animate">
              <ReviewsPage
                profile={shop.userProfile}
                onNavigate={shop.navigate}
              />
            </div>
          )}
          {shop.page === 'notifications' && (
            <div className="page-animate">
              <NotificationsPage
                notifications={shop.notifications}
                onBack={() => shop.navigate('profile')}
                onNavigate={shop.navigate}
              />
            </div>
          )}
        </div>

        {/* Bottom Navigation */}
        {!['detail', 'checkout', 'addresses', 'profile_edit', 'reviews', 'notifications'].includes(shop.page) && (
          <BottomNav page={shop.page} onNavigate={shop.navigate} cartCount={shop.cartCount} />
        )}
      </div>
    </main>
  )
}

export default App
