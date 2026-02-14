# Angular Framework

Angular is a development platform for building mobile and desktop web applications using TypeScript/JavaScript. It
provides a comprehensive framework for building scalable, maintainable single-page applications with features including
components, dependency injection, routing, forms, HTTP client, and reactive state management through signals.

The framework follows a component-based architecture where applications are built as a tree of reusable components.
Angular includes a powerful CLI for scaffolding, building, and testing applications, along with robust tooling for
development workflows. Key features include standalone components, signal-based reactivity, server-side rendering, and
comprehensive form handling with both template-driven and reactive approaches.

## Components

### Creating a Component

Components are the fundamental building blocks of Angular applications. Each component has a TypeScript class, HTML
template, and optional CSS styles.

```typescript
import { Component } from '@angular/core'

@Component({
  selector: 'profile-photo',
  template: `
    <img [src]="photoUrl" [alt]="userName + ' profile photo'" />
    <p>{{ userName }}</p>
  `,
  styles: `
    img {
      border-radius: 50%;
      width: 100px;
      height: 100px;
    }
    p {
      font-weight: bold;
    }
  `
})
export class ProfilePhoto {
  photoUrl = 'https://example.com/photo.jpg'
  userName = 'John Doe'
}
```

### Component Inputs with Signals

The `input()` function creates signal-based inputs that allow parent components to pass data to child components.

```typescript
import { Component, input, computed } from '@angular/core'

@Component({
  selector: 'custom-slider',
  template: `
    <div class="slider">
      <label>{{ label() }}</label>
      <input type="range" [min]="min()" [max]="max()" [value]="value()" />
      <span>{{ displayValue() }}</span>
    </div>
  `
})
export class CustomSlider {
  // Required input with explicit type
  value = input.required<number>()

  // Optional inputs with defaults
  min = input(0)
  max = input(100)
  label = input('', { transform: (v: string) => v?.trim() ?? '' })

  // Computed signal derived from inputs
  displayValue = computed(() => `${this.value()} / ${this.max()}`)
}

// Usage in parent component:
@Component({
  imports: [CustomSlider],
  template: `<custom-slider [value]="50" [max]="200" label="Volume" />`
})
export class AudioControls {}
```

### Component Outputs

The `output()` function creates event emitters for child-to-parent communication.

```typescript
import { Component, output, input } from '@angular/core'

@Component({
  selector: 'expandable-panel',
  template: `
    <div class="panel">
      <header (click)="toggle()">
        <h3>{{ title() }}</h3>
        <button>{{ isExpanded ? 'Collapse' : 'Expand' }}</button>
      </header>
      @if (isExpanded) {
        <div class="content">
          <ng-content />
        </div>
      }
    </div>
  `
})
export class ExpandablePanel {
  title = input.required<string>()

  // Output events
  panelOpened = output<void>()
  panelClosed = output<void>()
  stateChanged = output<{ isOpen: boolean; timestamp: Date }>()

  isExpanded = false

  toggle() {
    this.isExpanded = !this.isExpanded

    if (this.isExpanded) {
      this.panelOpened.emit()
    } else {
      this.panelClosed.emit()
    }

    this.stateChanged.emit({
      isOpen: this.isExpanded,
      timestamp: new Date()
    })
  }
}

// Usage in parent:
@Component({
  imports: [ExpandablePanel],
  template: `
    <expandable-panel title="Settings" (panelOpened)="logOpen()" (stateChanged)="handleStateChange($event)">
      <p>Panel content here</p>
    </expandable-panel>
  `
})
export class App {
  logOpen() {
    console.log('Panel opened')
  }
  handleStateChange(event: { isOpen: boolean; timestamp: Date }) {
    console.log('State:', event)
  }
}
```

### Two-Way Binding with Model Inputs

Model inputs enable two-way binding between parent and child components.

```typescript
import { Component, model, signal } from '@angular/core'

@Component({
  selector: 'custom-checkbox',
  template: `
    <label class="checkbox">
      <input type="checkbox" [checked]="checked()" (change)="onToggle($event)" />
      <span><ng-content /></span>
    </label>
  `
})
export class CustomCheckbox {
  // Model input for two-way binding
  checked = model(false)

  onToggle(event: Event) {
    const input = event.target as HTMLInputElement
    this.checked.set(input.checked)
  }
}

// Usage with two-way binding:
@Component({
  imports: [CustomCheckbox],
  template: `
    <custom-checkbox [(checked)]="receiveNotifications"> Receive notifications </custom-checkbox>
    <p>Notifications: {{ receiveNotifications() ? 'On' : 'Off' }}</p>
  `
})
export class Settings {
  receiveNotifications = signal(true)
}
```

## Signals

### Writable Signals

Signals are reactive primitives that track state changes and automatically update dependent computations.

```typescript
import { Component, signal, computed, effect } from '@angular/core'

@Component({
  selector: 'counter-app',
  template: `
    <div>
      <p>Count: {{ count() }}</p>
      <p>Double: {{ doubleCount() }}</p>
      <p>Message: {{ message() }}</p>
      <button (click)="increment()">+</button>
      <button (click)="decrement()">-</button>
      <button (click)="reset()">Reset</button>
    </div>
  `
})
export class CounterApp {
  // Writable signal with initial value
  count = signal(0)

  // Computed signal - automatically updates when count changes
  doubleCount = computed(() => this.count() * 2)

  // Computed with conditional logic
  message = computed(() => {
    const c = this.count()
    if (c < 0) return 'Negative!'
    if (c === 0) return 'Zero'
    if (c > 10) return 'High value!'
    return `Current: ${c}`
  })

  constructor() {
    // Effect runs whenever signals it reads change
    effect(() => {
      console.log(`Count changed to: ${this.count()}`)
      // Cleanup function (optional)
      return () => console.log('Cleaning up previous effect')
    })
  }

  increment() {
    this.count.update((c) => c + 1)
  }

  decrement() {
    this.count.set(this.count() - 1)
  }

  reset() {
    this.count.set(0)
  }
}
```

### Linked Signals and Resources

LinkedSignal creates writable signals that depend on other signals.

```typescript
import { Component, signal, linkedSignal, resource } from '@angular/core'

interface User {
  id: number
  name: string
  email: string
}

@Component({
  selector: 'user-profile',
  template: `
    <select (change)="selectUser($event)">
      @for (id of userIds; track id) {
        <option [value]="id">User {{ id }}</option>
      }
    </select>

    @if (userResource.isLoading()) {
      <p>Loading...</p>
    } @else if (userResource.error()) {
      <p>Error: {{ userResource.error() }}</p>
    } @else {
      <div>
        <h2>{{ userResource.value()?.name }}</h2>
        <p>{{ userResource.value()?.email }}</p>
        <input [value]="editableName()" (input)="updateName($event)" />
      </div>
    }
  `
})
export class UserProfile {
  userIds = [1, 2, 3, 4, 5]
  selectedUserId = signal(1)

  // Resource for async data fetching
  userResource = resource({
    request: () => ({ id: this.selectedUserId() }),
    loader: async ({ request }) => {
      const response = await fetch(`/api/users/${request.id}`)
      if (!response.ok) throw new Error('Failed to fetch user')
      return response.json() as Promise<User>
    }
  })

  // Linked signal resets when userResource changes
  editableName = linkedSignal(() => this.userResource.value()?.name ?? '')

  selectUser(event: Event) {
    const select = event.target as HTMLSelectElement
    this.selectedUserId.set(parseInt(select.value, 10))
  }

  updateName(event: Event) {
    const input = event.target as HTMLInputElement
    this.editableName.set(input.value)
  }
}
```

## Dependency Injection

### Creating and Using Services

Services provide reusable logic and state management across components.

```typescript
import { Injectable, inject, signal, computed } from '@angular/core'

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private items = signal<CartItem[]>([])

  // Public readonly access to cart state
  readonly cartItems = this.items.asReadonly()
  readonly itemCount = computed(() => this.items().reduce((sum, item) => sum + item.quantity, 0))
  readonly total = computed(() => this.items().reduce((sum, item) => sum + item.price * item.quantity, 0))

  addItem(product: { id: string; name: string; price: number }) {
    this.items.update((items) => {
      const existing = items.find((i) => i.id === product.id)
      if (existing) {
        return items.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i))
      }
      return [...items, { ...product, quantity: 1 }]
    })
  }

  removeItem(id: string) {
    this.items.update((items) => items.filter((i) => i.id !== id))
  }

  updateQuantity(id: string, quantity: number) {
    if (quantity <= 0) {
      this.removeItem(id)
      return
    }
    this.items.update((items) => items.map((i) => (i.id === id ? { ...i, quantity } : i)))
  }

  clearCart() {
    this.items.set([])
  }
}

// Using the service in a component
@Component({
  selector: 'shopping-cart',
  template: `
    <div class="cart">
      <h2>Cart ({{ cart.itemCount() }} items)</h2>
      @for (item of cart.cartItems(); track item.id) {
        <div class="cart-item">
          <span>{{ item.name }}</span>
          <span>{{ item.price | currency }}</span>
          <input type="number" [value]="item.quantity" (change)="updateQty(item.id, $event)" />
          <button (click)="cart.removeItem(item.id)">Remove</button>
        </div>
      } @empty {
        <p>Cart is empty</p>
      }
      <div class="total">
        <strong>Total: {{ cart.total() | currency }}</strong>
      </div>
      <button (click)="cart.clearCart()">Clear Cart</button>
    </div>
  `
})
export class ShoppingCart {
  cart = inject(CartService)

  updateQty(id: string, event: Event) {
    const input = event.target as HTMLInputElement
    this.cart.updateQuantity(id, parseInt(input.value, 10))
  }
}
```

### Hierarchical Injection and Tokens

Configure different service implementations using injection tokens and providers.

```typescript
import { Injectable, InjectionToken, inject, Component } from '@angular/core'

// Define an interface and token
export interface Logger {
  log(message: string): void
  error(message: string): void
}

export const LOGGER = new InjectionToken<Logger>('Logger')

// Different implementations
@Injectable()
export class ConsoleLogger implements Logger {
  log(message: string) {
    console.log(`[LOG] ${message}`)
  }
  error(message: string) {
    console.error(`[ERROR] ${message}`)
  }
}

@Injectable()
export class RemoteLogger implements Logger {
  private http = inject(HttpClient)

  log(message: string) {
    this.http.post('/api/logs', { level: 'info', message }).subscribe()
  }
  error(message: string) {
    this.http.post('/api/logs', { level: 'error', message }).subscribe()
  }
}

// Application config
export const appConfig: ApplicationConfig = {
  providers: [{ provide: LOGGER, useClass: ConsoleLogger }]
}

// Route-specific providers
export const adminRoutes: Routes = [
  {
    path: 'admin',
    providers: [{ provide: LOGGER, useClass: RemoteLogger }],
    children: [{ path: 'dashboard', component: AdminDashboard }]
  }
]

// Using the token
@Component({
  selector: 'app-root',
  template: `<button (click)="doSomething()">Action</button>`
})
export class App {
  private logger = inject(LOGGER)

  doSomething() {
    this.logger.log('Action performed')
  }
}
```

## HTTP Client

### Making HTTP Requests

HttpClient provides a powerful API for making HTTP requests with full TypeScript support.

```typescript
import { Injectable, inject, Component, signal } from '@angular/core'
import { HttpClient, HttpParams, HttpHeaders, HttpErrorResponse } from '@angular/common/http'
import { catchError, retry } from 'rxjs/operators'
import { throwError, Observable } from 'rxjs'

interface Post {
  id: number
  title: string
  body: string
  userId: number
}

interface CreatePostDto {
  title: string
  body: string
  userId: number
}

@Injectable({ providedIn: 'root' })
export class PostService {
  private http = inject(HttpClient)
  private baseUrl = '/api/posts'

  // GET request with type safety
  getPosts(userId?: number): Observable<Post[]> {
    let params = new HttpParams()
    if (userId) {
      params = params.set('userId', userId.toString())
    }

    return this.http.get<Post[]>(this.baseUrl, { params }).pipe(retry(2), catchError(this.handleError))
  }

  // GET single item
  getPost(id: number): Observable<Post> {
    return this.http.get<Post>(`${this.baseUrl}/${id}`).pipe(catchError(this.handleError))
  }

  // POST request
  createPost(post: CreatePostDto): Observable<Post> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'X-Custom-Header': 'value'
    })

    return this.http.post<Post>(this.baseUrl, post, { headers }).pipe(catchError(this.handleError))
  }

  // PUT request
  updatePost(id: number, post: Partial<Post>): Observable<Post> {
    return this.http.put<Post>(`${this.baseUrl}/${id}`, post).pipe(catchError(this.handleError))
  }

  // DELETE request
  deletePost(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(catchError(this.handleError))
  }

  // File upload with progress
  uploadFile(file: File): Observable<HttpEvent<any>> {
    const formData = new FormData()
    formData.append('file', file)

    return this.http.post('/api/upload', formData, {
      reportProgress: true,
      observe: 'events'
    })
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An error occurred'
    if (error.status === 0) {
      errorMessage = 'Network error - please check your connection'
    } else {
      errorMessage = `Server error: ${error.status} - ${error.message}`
    }
    console.error(errorMessage)
    return throwError(() => new Error(errorMessage))
  }
}

// Using in a component
@Component({
  selector: 'post-list',
  template: `
    @if (loading()) {
      <p>Loading posts...</p>
    } @else if (error()) {
      <p class="error">{{ error() }}</p>
      <button (click)="loadPosts()">Retry</button>
    } @else {
      @for (post of posts(); track post.id) {
        <article>
          <h3>{{ post.title }}</h3>
          <p>{{ post.body }}</p>
          <button (click)="deletePost(post.id)">Delete</button>
        </article>
      }
    }
  `
})
export class PostList {
  private postService = inject(PostService)

  posts = signal<Post[]>([])
  loading = signal(false)
  error = signal<string | null>(null)

  ngOnInit() {
    this.loadPosts()
  }

  loadPosts() {
    this.loading.set(true)
    this.error.set(null)

    this.postService.getPosts().subscribe({
      next: (posts) => {
        this.posts.set(posts)
        this.loading.set(false)
      },
      error: (err) => {
        this.error.set(err.message)
        this.loading.set(false)
      }
    })
  }

  deletePost(id: number) {
    this.postService.deletePost(id).subscribe({
      next: () => {
        this.posts.update((posts) => posts.filter((p) => p.id !== id))
      },
      error: (err) => this.error.set(err.message)
    })
  }
}
```

### HTTP Interceptors

Interceptors allow you to transform requests and responses globally.

```typescript
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http'
import { inject } from '@angular/core'
import { catchError, throwError } from 'rxjs'

// Auth interceptor
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService)
  const token = authService.getToken()

  if (token) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    })
    return next(cloned)
  }

  return next(req)
}

// Logging interceptor
export const loggingInterceptor: HttpInterceptorFn = (req, next) => {
  const started = Date.now()

  return next(req).pipe(
    tap({
      next: (event) => {
        if (event.type === HttpEventType.Response) {
          const elapsed = Date.now() - started
          console.log(`${req.method} ${req.url} completed in ${elapsed}ms`)
        }
      }
    })
  )
}

// Error handling interceptor
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        inject(AuthService).logout()
        inject(Router).navigate(['/login'])
      }
      return throwError(() => error)
    })
  )
}

// Register interceptors in app config
export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient(withInterceptors([authInterceptor, loggingInterceptor, errorInterceptor]))]
}
```

## Routing

### Defining Routes

Angular Router enables navigation between views and components.

```typescript
import { Routes, provideRouter } from '@angular/router'
import { ApplicationConfig } from '@angular/core'

// Route definitions
export const routes: Routes = [
  // Home route
  {
    path: '',
    component: HomePage,
    title: 'Home'
  },

  // Route with parameter
  {
    path: 'user/:id',
    component: UserProfile,
    title: 'User Profile'
  },

  // Lazy-loaded route
  {
    path: 'admin',
    loadComponent: () => import('./admin/admin.component'),
    loadChildren: () => import('./admin/admin.routes'),
    canActivate: [authGuard]
  },

  // Nested routes
  {
    path: 'products',
    component: ProductLayout,
    children: [
      { path: '', component: ProductList },
      { path: ':id', component: ProductDetail },
      { path: ':id/reviews', component: ProductReviews }
    ]
  },

  // Redirect
  { path: 'home', redirectTo: '', pathMatch: 'full' },

  // Wildcard (404)
  { path: '**', component: NotFoundPage }
]

// Application configuration
export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes)]
}
```

### Route Guards

Guards control access to routes based on conditions.

```typescript
import { inject } from '@angular/core'
import { CanActivateFn, CanDeactivateFn, Router, ResolveFn } from '@angular/router'

// Auth guard
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService)
  const router = inject(Router)

  if (authService.isAuthenticated()) {
    return true
  }

  // Redirect to login with return URL
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url }
  })
}

// Role-based guard
export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService)
  const requiredRoles = route.data['roles'] as string[]

  return requiredRoles.some((role) => authService.hasRole(role))
}

// Unsaved changes guard
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean
}

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  if (component.hasUnsavedChanges()) {
    return confirm('You have unsaved changes. Leave anyway?')
  }
  return true
}

// Data resolver
export const userResolver: ResolveFn<User> = (route) => {
  const userService = inject(UserService)
  const userId = route.paramMap.get('id')!
  return userService.getUser(userId)
}

// Using guards in routes
export const routes: Routes = [
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin', 'superadmin'] },
    children: [
      {
        path: 'settings',
        component: AdminSettings,
        canDeactivate: [unsavedChangesGuard]
      }
    ]
  },
  {
    path: 'user/:id',
    component: UserProfile,
    resolve: { user: userResolver }
  }
]
```

### Reading Route State

Access route parameters, query parameters, and resolved data in components.

```typescript
import { Component, inject } from '@angular/core'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { toSignal } from '@angular/core/rxjs-interop'
import { map } from 'rxjs/operators'

@Component({
  selector: 'product-detail',
  imports: [RouterLink],
  template: `
    <nav>
      <a [routerLink]="['/products']">Back to Products</a>
    </nav>

    @if (product(); as prod) {
      <h1>{{ prod.name }}</h1>
      <p>{{ prod.description }}</p>
      <p>Price: {{ prod.price | currency }}</p>

      <a [routerLink]="['/products', prod.id, 'reviews']" [queryParams]="{ sort: 'recent' }"> View Reviews </a>
    }

    @if (sortOrder()) {
      <p>Sorting by: {{ sortOrder() }}</p>
    }
  `
})
export class ProductDetail {
  private route = inject(ActivatedRoute)
  private router = inject(Router)

  // Convert route observables to signals
  product = toSignal(this.route.data.pipe(map((data) => data['product'] as Product)))

  productId = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))))

  sortOrder = toSignal(this.route.queryParamMap.pipe(map((params) => params.get('sort'))))

  // Programmatic navigation
  goToReviews() {
    this.router.navigate(['reviews'], {
      relativeTo: this.route,
      queryParams: { sort: 'helpful' },
      queryParamsHandling: 'merge'
    })
  }
}
```

## Reactive Forms

### FormGroup and FormControl

Reactive forms provide model-driven form handling with full type safety.

```typescript
import { Component, inject } from '@angular/core'
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormControl,
  Validators,
  AbstractControl,
  ValidationErrors
} from '@angular/forms'

// Custom validator
function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')
  const confirmPassword = control.get('confirmPassword')

  if (password && confirmPassword && password.value !== confirmPassword.value) {
    return { passwordMismatch: true }
  }
  return null
}

// Async validator
function uniqueEmailValidator(userService: UserService) {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    return userService.checkEmailExists(control.value).pipe(
      map((exists) => (exists ? { emailTaken: true } : null)),
      catchError(() => of(null))
    )
  }
}

@Component({
  selector: 'registration-form',
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <div>
        <label for="email">Email</label>
        <input id="email" formControlName="email" type="email" />
        @if (form.get('email')?.errors?.['required'] && form.get('email')?.touched) {
          <span class="error">Email is required</span>
        }
        @if (form.get('email')?.errors?.['email']) {
          <span class="error">Invalid email format</span>
        }
        @if (form.get('email')?.errors?.['emailTaken']) {
          <span class="error">Email already registered</span>
        }
      </div>

      <div formGroupName="passwords">
        <div>
          <label for="password">Password</label>
          <input id="password" formControlName="password" type="password" />
          @if (form.get('passwords.password')?.errors?.['minlength']) {
            <span class="error">Password must be at least 8 characters</span>
          }
        </div>

        <div>
          <label for="confirmPassword">Confirm Password</label>
          <input id="confirmPassword" formControlName="confirmPassword" type="password" />
        </div>

        @if (form.get('passwords')?.errors?.['passwordMismatch']) {
          <span class="error">Passwords do not match</span>
        }
      </div>

      <div formGroupName="profile">
        <label for="firstName">First Name</label>
        <input id="firstName" formControlName="firstName" />

        <label for="lastName">Last Name</label>
        <input id="lastName" formControlName="lastName" />
      </div>

      <button type="submit" [disabled]="form.invalid || form.pending">
        {{ form.pending ? 'Validating...' : 'Register' }}
      </button>
    </form>

    <pre>Form Status: {{ form.status }}</pre>
    <pre>Form Value: {{ form.value | json }}</pre>
  `
})
export class RegistrationForm {
  private fb = inject(FormBuilder)
  private userService = inject(UserService)

  form = this.fb.group({
    email: [
      '',
      {
        validators: [Validators.required, Validators.email],
        asyncValidators: [uniqueEmailValidator(this.userService)],
        updateOn: 'blur'
      }
    ],
    passwords: this.fb.group(
      {
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', Validators.required]
      },
      { validators: passwordMatchValidator }
    ),
    profile: this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required]
    })
  })

  onSubmit() {
    if (this.form.valid) {
      console.log('Form submitted:', this.form.value)
      // Process registration
    } else {
      // Mark all fields as touched to show errors
      this.form.markAllAsTouched()
    }
  }
}
```

### Dynamic Forms with FormArray

FormArray handles dynamic collections of form controls.

```typescript
import { Component, inject } from '@angular/core'
import { ReactiveFormsModule, FormBuilder, FormArray, Validators } from '@angular/forms'

@Component({
  selector: 'order-form',
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="orderForm" (ngSubmit)="submitOrder()">
      <h2>Order Form</h2>

      <div formArrayName="items">
        <h3>Items</h3>
        @for (item of items.controls; track $index; let i = $index) {
          <div [formGroupName]="i" class="item-row">
            <input formControlName="productName" placeholder="Product" />
            <input formControlName="quantity" type="number" min="1" />
            <input formControlName="price" type="number" step="0.01" />
            <span>Subtotal: {{ getSubtotal(i) | currency }}</span>
            <button type="button" (click)="removeItem(i)">Remove</button>
          </div>
        }
      </div>

      <button type="button" (click)="addItem()">Add Item</button>

      <div class="totals">
        <strong>Total: {{ calculateTotal() | currency }}</strong>
      </div>

      <div formGroupName="shipping">
        <h3>Shipping Address</h3>
        <input formControlName="street" placeholder="Street" />
        <input formControlName="city" placeholder="City" />
        <input formControlName="zipCode" placeholder="ZIP Code" />
      </div>

      <button type="submit" [disabled]="orderForm.invalid">Place Order</button>
    </form>
  `
})
export class OrderForm {
  private fb = inject(FormBuilder)

  orderForm = this.fb.group({
    items: this.fb.array([this.createItemGroup()]),
    shipping: this.fb.group({
      street: ['', Validators.required],
      city: ['', Validators.required],
      zipCode: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]]
    })
  })

  get items(): FormArray {
    return this.orderForm.get('items') as FormArray
  }

  createItemGroup() {
    return this.fb.group({
      productName: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      price: [0, [Validators.required, Validators.min(0)]]
    })
  }

  addItem() {
    this.items.push(this.createItemGroup())
  }

  removeItem(index: number) {
    if (this.items.length > 1) {
      this.items.removeAt(index)
    }
  }

  getSubtotal(index: number): number {
    const item = this.items.at(index)
    return item.get('quantity')?.value * item.get('price')?.value || 0
  }

  calculateTotal(): number {
    return this.items.controls.reduce((total, item, index) => {
      return total + this.getSubtotal(index)
    }, 0)
  }

  submitOrder() {
    if (this.orderForm.valid) {
      console.log('Order:', this.orderForm.value)
    }
  }
}
```

## Directives

### Attribute Directives

Attribute directives change the appearance or behavior of elements.

```typescript
import { Directive, ElementRef, HostListener, inject, input } from '@angular/core'

@Directive({
  selector: '[appHighlight]'
})
export class HighlightDirective {
  private el = inject(ElementRef)

  // Input for highlight color
  highlightColor = input('yellow', { alias: 'appHighlight' })
  defaultColor = input('transparent')

  @HostListener('mouseenter')
  onMouseEnter() {
    this.highlight(this.highlightColor())
  }

  @HostListener('mouseleave')
  onMouseLeave() {
    this.highlight(this.defaultColor())
  }

  private highlight(color: string) {
    this.el.nativeElement.style.backgroundColor = color
  }
}

// Usage
@Component({
  imports: [HighlightDirective],
  template: `
    <p appHighlight="lightblue">Hover over me!</p>
    <p [appHighlight]="dynamicColor" defaultColor="lightgray">Dynamic color</p>
  `
})
export class App {
  dynamicColor = 'pink'
}
```

### Structural Directives

Structural directives add, remove, or manipulate DOM elements.

```typescript
import { Directive, TemplateRef, ViewContainerRef, inject, input, effect } from '@angular/core'

@Directive({
  selector: '[appRepeat]'
})
export class RepeatDirective {
  private templateRef = inject(TemplateRef<any>)
  private viewContainer = inject(ViewContainerRef)

  count = input.required<number>({ alias: 'appRepeat' })

  constructor() {
    effect(() => {
      this.viewContainer.clear()
      for (let i = 0; i < this.count(); i++) {
        this.viewContainer.createEmbeddedView(this.templateRef, {
          $implicit: i,
          index: i,
          first: i === 0,
          last: i === this.count() - 1
        })
      }
    })
  }
}

// Permission directive
@Directive({
  selector: '[appHasPermission]'
})
export class HasPermissionDirective {
  private templateRef = inject(TemplateRef<any>)
  private viewContainer = inject(ViewContainerRef)
  private authService = inject(AuthService)

  permission = input.required<string>({ alias: 'appHasPermission' })

  private hasView = false

  constructor() {
    effect(() => {
      const hasPermission = this.authService.hasPermission(this.permission())

      if (hasPermission && !this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef)
        this.hasView = true
      } else if (!hasPermission && this.hasView) {
        this.viewContainer.clear()
        this.hasView = false
      }
    })
  }
}

// Usage
@Component({
  imports: [RepeatDirective, HasPermissionDirective],
  template: `
    <ul>
      <li *appRepeat="5; let i; let isFirst = first">Item {{ i + 1 }} {{ isFirst ? '(first)' : '' }}</li>
    </ul>

    <button *appHasPermission="'admin:delete'">Delete All</button>
  `
})
export class App {}
```

## Lifecycle Hooks and AfterRender

### Component Lifecycle

Angular components have lifecycle hooks for initialization, change detection, and cleanup.

```typescript
import { Component, OnInit, OnDestroy, AfterViewInit, input, effect, DestroyRef, inject } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'

@Component({
  selector: 'data-viewer',
  template: `<div #container>{{ data() }}</div>`
})
export class DataViewer implements OnInit, AfterViewInit, OnDestroy {
  private destroyRef = inject(DestroyRef)
  private dataService = inject(DataService)

  data = input<string>()

  @ViewChild('container') container!: ElementRef

  constructor() {
    // Effect runs when signal dependencies change
    effect(() => {
      console.log('Data changed:', this.data())
    })

    // Register cleanup on destroy
    this.destroyRef.onDestroy(() => {
      console.log('Component being destroyed')
    })
  }

  ngOnInit() {
    // Component initialized, inputs are available
    console.log('OnInit - data:', this.data())

    // Subscribe with automatic cleanup
    this.dataService.stream$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      console.log('Stream value:', value)
    })
  }

  ngAfterViewInit() {
    // View is initialized, @ViewChild is available
    console.log('Container element:', this.container.nativeElement)
  }

  ngOnDestroy() {
    // Manual cleanup if needed
    console.log('OnDestroy')
  }
}
```

### AfterRender Hooks

AfterRender hooks execute code after Angular renders content to the DOM.

```typescript
import { Component, afterNextRender, afterRender, ElementRef, inject, signal } from '@angular/core'

@Component({
  selector: 'chart-component',
  template: `
    <div #chartContainer class="chart"></div>
    <button (click)="updateData()">Update Data</button>
  `
})
export class ChartComponent {
  private elementRef = inject(ElementRef)

  chartData = signal([10, 20, 30, 40, 50])
  private chart: any

  constructor() {
    // Run once after first render (good for initialization)
    afterNextRender(() => {
      const container = this.elementRef.nativeElement.querySelector('.chart')
      this.chart = new Chart(container, {
        data: this.chartData()
        // ... chart options
      })
    })

    // Run after every render (use sparingly)
    afterRender(() => {
      if (this.chart) {
        this.chart.update(this.chartData())
      }
    })
  }

  updateData() {
    this.chartData.update((data) => data.map((v) => v + Math.random() * 10))
  }
}
```

## Summary

Angular provides a comprehensive framework for building modern web applications with a component-based architecture. The
key APIs covered include signal-based reactivity for state management, dependency injection for service composition,
reactive forms for complex form handling, and the HttpClient for backend communication. The framework's strong typing
with TypeScript ensures type safety throughout the application.

The integration patterns in Angular favor composition through standalone components, signal-based state management, and
functional approaches to guards and interceptors. Applications typically organize code into feature modules with lazy
loading for performance, shared services for cross-cutting concerns, and clear separation between presentation
components and business logic. The CLI tooling supports scaffolding, building, testing, and deployment workflows, making
Angular suitable for large-scale enterprise applications.
