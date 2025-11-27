import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import {
  Service,
  ServiceRequest,
  ServiceOrder,
  ServiceCategory,
  RequestStatus,
  OrderStatus,
  ServiceStatus,
  ServiceDeliverable,
} from '../types/service';

interface ServiceState {
  // Services
  services: Service[];
  categories: ServiceCategory[];
  featuredServices: Service[];
  popularServices: Service[];
  loading: boolean;
  error: string | null;

  // User Requests and Orders
  userRequests: ServiceRequest[];
  userOrders: ServiceOrder[];
  activeRequest: ServiceRequest | null;
  activeOrder: ServiceOrder | null;

  // Filters and Search
  searchQuery: string;
  selectedCategory: string | null;
  priceRange: [number, number];
  selectedStatus: ServiceStatus | null;
  sortBy: 'name' | 'price' | 'rating' | 'popularity' | 'newest';
  sortOrder: 'asc' | 'desc';

  // Pagination
  currentPage: number;
  totalPages: number;
  totalServices: number;
  pageSize: number;

  // Actions
  setServices: (services: Service[]) => void;
  setCategories: (categories: ServiceCategory[]) => void;
  setFeaturedServices: (services: Service[]) => void;
  setPopularServices: (services: Service[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // User Actions
  setUserRequests: (requests: ServiceRequest[]) => void;
  setUserOrders: (orders: ServiceOrder[]) => void;
  setActiveRequest: (request: ServiceRequest | null) => void;
  setActiveOrder: (order: ServiceOrder | null) => void;
  addUserRequest: (request: ServiceRequest) => void;
  updateUserRequest: (requestId: string, updates: Partial<ServiceRequest>) => void;
  addUserOrder: (order: ServiceOrder) => void;
  updateUserOrder: (orderId: string, updates: Partial<ServiceOrder>) => void;

  // Filter and Search Actions
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (categoryId: string | null) => void;
  setPriceRange: (range: [number, number]) => void;
  setSelectedStatus: (status: ServiceStatus | null) => void;
  setSortBy: (sortBy: 'name' | 'price' | 'rating' | 'popularity' | 'newest') => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  clearFilters: () => void;

  // Pagination Actions
  setCurrentPage: (page: number) => void;
  setTotalPages: (pages: number) => void;
  setTotalServices: (total: number) => void;
  setPageSize: (size: number) => void;

  // Computed Selectors
  filteredServices: () => Service[];
  servicesByCategory: (categoryId: string) => Service[];
  servicesByStatus: (status: ServiceStatus) => Service[];
  getServiceById: (id: string) => Service | undefined;
  getRequestsByStatus: (status: RequestStatus) => ServiceRequest[];
  getOrdersByStatus: (status: OrderStatus) => ServiceOrder[];
  getUpcomingDeliverables: () => ServiceDeliverable[];
  getActiveServices: () => Service[];
}

const useServiceStore = create<ServiceState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial State
        services: [],
        categories: [],
        featuredServices: [],
        popularServices: [],
        loading: false,
        error: null,

        userRequests: [],
        userOrders: [],
        activeRequest: null,
        activeOrder: null,

        searchQuery: '',
        selectedCategory: null,
        priceRange: [0, 100000],
        selectedStatus: null,
        sortBy: 'name',
        sortOrder: 'asc',

        currentPage: 1,
        totalPages: 1,
        totalServices: 0,
        pageSize: 12,

        // Actions
        setServices: (services) => set({ services }),
        setCategories: (categories) => set({ categories }),
        setFeaturedServices: (services) => set({ featuredServices: services }),
        setPopularServices: (services) => set({ popularServices: services }),
        setLoading: (loading) => set({ loading }),
        setError: (error) => set({ error }),

        // User Actions
        setUserRequests: (requests) => set({ userRequests: requests }),
        setUserOrders: (orders) => set({ userOrders: orders }),
        setActiveRequest: (request) => set({ activeRequest: request }),
        setActiveOrder: (order) => set({ activeOrder: order }),

        addUserRequest: (request) =>
          set((state) => ({
            userRequests: [...state.userRequests, request],
          })),

        updateUserRequest: (requestId, updates) =>
          set((state) => ({
            userRequests: state.userRequests.map((request) =>
              request.id === requestId ? { ...request, ...updates } : request
            ),
            activeRequest:
              state.activeRequest?.id === requestId
                ? { ...state.activeRequest, ...updates }
                : state.activeRequest,
          })),

        addUserOrder: (order) =>
          set((state) => ({
            userOrders: [...state.userOrders, order],
          })),

        updateUserOrder: (orderId, updates) =>
          set((state) => ({
            userOrders: state.userOrders.map((order) =>
              order.id === orderId ? { ...order, ...updates } : order
            ),
            activeOrder:
              state.activeOrder?.id === orderId
                ? { ...state.activeOrder, ...updates }
                : state.activeOrder,
          })),

        // Filter and Search Actions
        setSearchQuery: (searchQuery) => set({ searchQuery, currentPage: 1 }),
        setSelectedCategory: (selectedCategory) => set({ selectedCategory, currentPage: 1 }),
        setPriceRange: (priceRange) => set({ priceRange, currentPage: 1 }),
        setSelectedStatus: (selectedStatus) => set({ selectedStatus, currentPage: 1 }),
        setSortBy: (sortBy) => set({ sortBy }),
        setSortOrder: (sortOrder) => set({ sortOrder }),

        clearFilters: () =>
          set({
            searchQuery: '',
            selectedCategory: null,
            priceRange: [0, 100000],
            selectedStatus: null,
            currentPage: 1,
          }),

        // Pagination Actions
        setCurrentPage: (currentPage) => set({ currentPage }),
        setTotalPages: (totalPages) => set({ totalPages }),
        setTotalServices: (totalServices) => set({ totalServices }),
        setPageSize: (pageSize) => set({ pageSize }),

        // Computed Selectors
        filteredServices: () => {
          const state = get();
          let filtered = [...state.services];

          // Search Filter
          if (state.searchQuery) {
            const query = state.searchQuery.toLowerCase();
            filtered = filtered.filter(
              (service) =>
                service.name.toLowerCase().includes(query) ||
                service.description.toLowerCase().includes(query) ||
                service.features.some((feature) => feature.toLowerCase().includes(query))
            );
          }

          // Category Filter
          if (state.selectedCategory) {
            filtered = filtered.filter((service) => service.category.id === state.selectedCategory);
          }

          // Status Filter
          if (state.selectedStatus) {
            filtered = filtered.filter((service) => service.status === state.selectedStatus);
          }

          // Price Range Filter
          filtered = filtered.filter(
            (service) =>
              service.pricing.basePrice >= state.priceRange[0] &&
              service.pricing.basePrice <= state.priceRange[1]
          );

          // Sorting
          filtered.sort((a, b) => {
            let aValue: any, bValue: any;

            switch (state.sortBy) {
              case 'name':
                aValue = a.name.toLowerCase();
                bValue = b.name.toLowerCase();
                break;
              case 'price':
                aValue = a.pricing.basePrice;
                bValue = b.pricing.basePrice;
                break;
              case 'rating':
                aValue = a.metadata.ratings.average;
                bValue = b.metadata.ratings.average;
                break;
              case 'popularity':
                aValue = a.metadata.ratings.totalReviews;
                bValue = b.metadata.ratings.totalReviews;
                break;
              case 'newest':
                aValue = new Date(a.createdAt).getTime();
                bValue = new Date(b.createdAt).getTime();
                break;
              default:
                return 0;
            }

            if (state.sortOrder === 'asc') {
              return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
            } else {
              return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
            }
          });

          return filtered;
        },

        servicesByCategory: (categoryId) => {
          const state = get();
          return state.services.filter((service) => service.category.id === categoryId);
        },

        servicesByStatus: (status) => {
          const state = get();
          return state.services.filter((service) => service.status === status);
        },

        getServiceById: (id) => {
          const state = get();
          return state.services.find((service) => service.id === id);
        },

        getRequestsByStatus: (status) => {
          const state = get();
          return state.userRequests.filter((request) => request.status === status);
        },

        getOrdersByStatus: (status) => {
          const state = get();
          return state.userOrders.filter((order) => order.status === status);
        },

        getUpcomingDeliverables: () => {
          const state = get();
          const deliverables: any[] = [];

          state.userOrders.forEach((order) => {
            order.deliverables.forEach((deliverable) => {
              if (deliverable.status !== 'delivered') {
                deliverables.push(deliverable);
              }
            });
          });

          return deliverables.sort((a, b) => 
            new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
          );
        },

        getActiveServices: () => {
          const state = get();
          return state.services.filter((service) => service.status === 'active');
        },
      }),
      {
        name: 'service-store',
        partialize: (state) => ({
          // Only persist non-sensitive data
          services: state.services,
          categories: state.categories,
          featuredServices: state.featuredServices,
          popularServices: state.popularServices,
          searchQuery: state.searchQuery,
          selectedCategory: state.selectedCategory,
          priceRange: state.priceRange,
          selectedStatus: state.selectedStatus,
          sortBy: state.sortBy,
          sortOrder: state.sortOrder,
          currentPage: state.currentPage,
          pageSize: state.pageSize,
        }),
      }
    ),
    {
      name: 'service-store-dev',
    }
  )
);

export default useServiceStore;