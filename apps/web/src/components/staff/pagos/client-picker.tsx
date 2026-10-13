'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { fieldA11y } from '@/components/staff/form-primitives';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api/client';
import type { ClientRowDto, Paginated } from '@/lib/api/types';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const RESULTS_PAGE_SIZE = 8;

type PickedClient = Pick<ClientRowDto, 'id' | 'name' | 'email'>;

function useDebouncedValue(value: string): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value]);
  return debounced;
}

interface ClientPickerProps {
  id: string;
  selected: PickedClient | null;
  error?: string;
  onSelect: (client: PickedClient | null) => void;
}

export function ClientPicker({ id, selected, error, onSelect }: ClientPickerProps) {
  const [text, setText] = useState('');
  const term = useDebouncedValue(text).trim();
  const searching = selected === null && term.length >= MIN_QUERY_LENGTH;
  const { data, isFetching, isError } = useQuery({
    queryKey: ['staff', 'clients', 'picker', term],
    queryFn: () => apiFetch<Paginated<ClientRowDto>>('/staff/clients', { query: { q: term, pageSize: RESULTS_PAGE_SIZE } }),
    enabled: searching,
  });

  const handleChange = (value: string) => {
    setText(value);
    if (selected) onSelect(null);
  };

  const handlePick = (client: PickedClient) => {
    setText(client.name);
    onSelect(client);
  };

  return (
    <div className="space-y-2">
      <Input
        id={id}
        value={text}
        autoComplete="off"
        placeholder="Buscá por nombre o email"
        {...fieldA11y(id, error)}
        onChange={(event) => handleChange(event.target.value)}
      />
      {selected ? (
        <p className="text-xs text-muted-foreground">
          Seleccionado: {selected.name} · {selected.email}
        </p>
      ) : null}
      {searching && data && data.items.length > 0 ? (
        <ul className="max-h-48 overflow-y-auto rounded border border-border bg-card">
          {data.items.map((client) => (
            <li key={client.id}>
              <button
                type="button"
                className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-soft"
                onClick={() => handlePick(client)}
              >
                <span className="font-medium">{client.name}</span>
                <span className="text-xs text-muted-foreground">{client.email}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {searching && isError ? (
        <p role="alert" className="text-xs text-danger">
          No pudimos buscar clientes. Probá de nuevo.
        </p>
      ) : null}
      {searching && data && data.items.length === 0 && !isFetching ? (
        <p className="text-xs text-muted-foreground">No encontramos clientes con esa búsqueda.</p>
      ) : null}
    </div>
  );
}
