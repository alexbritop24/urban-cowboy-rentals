update private.rental_equipment_catalog
set daily_rate = 280,
    updated_at = now()
where equipment_id = 'bobcat-e35r2-compact-excavator';
