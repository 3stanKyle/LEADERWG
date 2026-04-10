import React, { createContext, useContext, useReducer, useCallback } from 'react';

// Initial state
const initialState = {
  items: [],
  customerInfo: {
    name: '',
    email: '',
    accountManagerEmail: '',
  },
  notes: '',
};

// Action types
const ACTIONS = {
  ADD_ITEM: 'ADD_ITEM',
  REMOVE_ITEM: 'REMOVE_ITEM',
  REMOVE_ITEM_BY_SKU: 'REMOVE_ITEM_BY_SKU',
  UPDATE_QUANTITY: 'UPDATE_QUANTITY',
  CLEAR_CART: 'CLEAR_CART',
  SET_CUSTOMER_INFO: 'SET_CUSTOMER_INFO',
  SET_NOTES: 'SET_NOTES',
  LOAD_QUOTE: 'LOAD_QUOTE',
};

// Reducer
function quoteReducer(state, action) {
  switch (action.type) {
    case ACTIONS.ADD_ITEM: {
      const { item } = action.payload;
      // Check if item with same SKU already exists
      const existingIndex = state.items.findIndex((i) => i.sku === item.sku);

      if (existingIndex !== -1) {
        // Update quantity of existing item
        const updatedItems = [...state.items];
        updatedItems[existingIndex] = {
          ...updatedItems[existingIndex],
          quantity: updatedItems[existingIndex].quantity + (item.quantity || 1),
        };
        return { ...state, items: updatedItems };
      }

      // Add new item
      const newItem = {
        id: Date.now() + Math.random(),
        sku: item.sku,
        name: item.name,
        description: item.description || '',
        unitPrice: item.unitPrice || 0,
        image: item.image || null,
        quantity: item.quantity || 1,
        productUrl: item.productUrl || null,
      };
      return { ...state, items: [...state.items, newItem] };
    }

    case ACTIONS.REMOVE_ITEM: {
      return {
        ...state,
        items: state.items.filter((item) => item.id !== action.payload.id),
      };
    }

    case ACTIONS.REMOVE_ITEM_BY_SKU: {
      const sku = action.payload.sku;
      return {
        ...state,
        items: state.items.filter((item) =>
          item.sku !== sku &&
          item.sku !== `NWG-${sku}` &&
          item.sku.replace('NWG-', '') !== sku
        ),
      };
    }

    case ACTIONS.UPDATE_QUANTITY: {
      const { id, quantity } = action.payload;
      if (quantity < 1) {
        return {
          ...state,
          items: state.items.filter((item) => item.id !== id),
        };
      }
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === id ? { ...item, quantity } : item
        ),
      };
    }

    case ACTIONS.CLEAR_CART: {
      return { ...state, items: [] };
    }

    case ACTIONS.SET_CUSTOMER_INFO: {
      return {
        ...state,
        customerInfo: { ...state.customerInfo, ...action.payload },
      };
    }

    case ACTIONS.SET_NOTES: {
      return { ...state, notes: action.payload };
    }

    case ACTIONS.LOAD_QUOTE: {
      return { ...state, ...action.payload };
    }

    default:
      return state;
  }
}

// Create context
const QuoteContext = createContext(null);

// Provider component
export function QuoteProvider({ children }) {
  const [state, dispatch] = useReducer(quoteReducer, initialState);

  // Actions
  const addItem = useCallback((item) => {
    dispatch({ type: ACTIONS.ADD_ITEM, payload: { item } });
  }, []);

  const removeItem = useCallback((id) => {
    dispatch({ type: ACTIONS.REMOVE_ITEM, payload: { id } });
  }, []);

  const removeItemBySku = useCallback((sku) => {
    dispatch({ type: ACTIONS.REMOVE_ITEM_BY_SKU, payload: { sku } });
  }, []);

  const updateQuantity = useCallback((id, quantity) => {
    dispatch({ type: ACTIONS.UPDATE_QUANTITY, payload: { id, quantity } });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: ACTIONS.CLEAR_CART });
  }, []);

  const setCustomerInfo = useCallback((info) => {
    dispatch({ type: ACTIONS.SET_CUSTOMER_INFO, payload: info });
  }, []);

  const setNotes = useCallback((notes) => {
    dispatch({ type: ACTIONS.SET_NOTES, payload: notes });
  }, []);

  const loadQuote = useCallback((quoteData) => {
    dispatch({ type: ACTIONS.LOAD_QUOTE, payload: quoteData });
  }, []);

  // Computed values
  const subtotal = state.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  const itemCount = state.items.reduce((sum, item) => sum + item.quantity, 0);

  const value = {
    state: {
      ...state,
      subtotal,
      itemCount,
    },
    addItem,
    removeItem,
    removeItemBySku,
    updateQuantity,
    clearCart,
    setCustomerInfo,
    setNotes,
    loadQuote,
  };

  return (
    <QuoteContext.Provider value={value}>{children}</QuoteContext.Provider>
  );
}

// Hook
export function useQuote() {
  const context = useContext(QuoteContext);
  if (!context) {
    throw new Error('useQuote must be used within a QuoteProvider');
  }
  return context;
}

export default QuoteContext;
