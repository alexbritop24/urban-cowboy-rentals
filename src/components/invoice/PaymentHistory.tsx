import { useEffect, useState } from "react";

import { getInvoicePayments } from "../../services/paymentService";
import {
  loadingPaymentHistoryState,
  type PaymentHistoryLoadState,
} from "../../utils/documentPresentation";
import PaymentHistoryContent, {
  type PaymentHistoryEntry,
} from "./PaymentHistoryContent";

interface PaymentHistoryProps {
  invoiceId: string;
  refreshKey: number;
  onStateChange?: (state: PaymentHistoryLoadState) => void;
}

export default function PaymentHistory({
  invoiceId,
  refreshKey,
  onStateChange,
}: PaymentHistoryProps) {
  const [payments, setPayments] = useState<PaymentHistoryEntry[]>([]);
  const [loadState, setLoadState] = useState<PaymentHistoryLoadState>(
    loadingPaymentHistoryState
  );

  useEffect(() => {
    let active = true;

    const loadPayments = async () => {
      setLoadState(loadingPaymentHistoryState);
      onStateChange?.(loadingPaymentHistoryState);

      try {
        const result = await getInvoicePayments(invoiceId);
        if (!active) return;

        const loadedPayments = result as PaymentHistoryEntry[];
        const readyState: PaymentHistoryLoadState = {
          status: "ready",
          paymentCount: loadedPayments.length,
        };
        setPayments(loadedPayments);
        setLoadState(readyState);
        onStateChange?.(readyState);
      } catch (error) {
        if (!active) return;

        console.error("LOAD PAYMENT HISTORY ERROR:", error);
        const errorState: PaymentHistoryLoadState = {
          status: "error",
          paymentCount: 0,
          message: "Could not load payment history.",
        };
        setPayments([]);
        setLoadState(errorState);
        onStateChange?.(errorState);
      }
    };

    void loadPayments();

    return () => {
      active = false;
    };
  }, [invoiceId, onStateChange, refreshKey]);

  return <PaymentHistoryContent payments={payments} state={loadState} />;
}
