-- Allow accountant (cashier role) to update installment amounts so they can clear/adjust dues.
CREATE POLICY "accountant update installments"
ON public.installments
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'cashier'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'cashier'::app_role));