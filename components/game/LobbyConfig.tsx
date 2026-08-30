"use client";

import { Minus, Plus, SlidersHorizontal } from "lucide-react";
import {
  BUDGET_PRESETS,
  MAX_BUDGET,
  MAX_PLAYERS,
  MAX_SLOTS,
  MIN_BUDGET,
  MIN_PLAYERS,
  MIN_SLOTS,
  LOT_TIMER_CHOICES,
  LOT_TIMER_DURATION,
} from "@/lib/game";
import { useT } from "@/lib/settings";
import type { CurrencyCode, RoomConfig } from "@/lib/types";
import { CURRENCIES, CURRENCY_SYMBOLS, cn, money } from "@/lib/utils";
import { Input } from "@/components/ui/Input";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import { Switch } from "@/components/ui/Switch";

interface LobbyConfigProps {
  config: RoomConfig;
  disabled?: boolean;
  onChange: (patch: Partial<RoomConfig>) => void;
}

export function LobbyConfig({ config, disabled = false, onChange }: LobbyConfigProps) {
  const t = useT();

  return (
    <Panel className={disabled ? "opacity-60" : undefined}>
      <PanelTitle icon={<SlidersHorizontal className="size-3.5" />}>
        {t("lobby.settings")}
      </PanelTitle>

      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-faint">
            {t("common.budget")}
          </p>
          <div className="flex gap-1.5">
            {BUDGET_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ budget: preset })}
                className={cn(
                  "h-11 flex-1 rounded-xl border text-sm font-bold transition-colors",
                  config.budget === preset
                    ? "border-neon bg-neon/15 text-neon"
                    : "border-line bg-surface-2 text-muted hover:text-fg",
                )}
              >
                {money(preset, config.currency)}
              </button>
            ))}
            <input
              type="number"
              inputMode="numeric"
              disabled={disabled}
              min={MIN_BUDGET}
              max={MAX_BUDGET}
              value={config.budget}
              onChange={(event) => onChange({ budget: Number(event.target.value) || MIN_BUDGET })}
              className="h-11 w-20 rounded-xl border border-line bg-surface-2 px-3 text-center font-mono text-sm text-fg focus:border-neon/70 focus:outline-none"
            />
          </div>
          <p className="mt-1.5 text-xs text-faint">{t("lobby.budgetHint")}</p>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-faint">
            {t("common.currency")}
          </p>
          <div className="flex gap-1.5">
            {CURRENCIES.map((currency: CurrencyCode) => (
              <button
                key={currency}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ currency })}
                className={cn(
                  "h-11 flex-1 rounded-xl border text-lg font-bold transition-colors",
                  config.currency === currency
                    ? "border-neon bg-neon/15 text-neon"
                    : "border-line bg-surface-2 text-muted hover:text-fg",
                )}
              >
                {CURRENCY_SYMBOLS[currency]}
              </button>
            ))}
          </div>
        </div>

        <Stepper
          label={t("common.players")}
          value={config.maxPlayers}
          min={MIN_PLAYERS}
          max={MAX_PLAYERS}
          disabled={disabled}
          onChange={(maxPlayers) => onChange({ maxPlayers })}
        />

        {/* Quanto dura un lotto: veloce, standard o comodo. */}
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-faint">
            {t("lobby.timer")}
          </p>
          <div className="flex gap-1.5">
            {LOT_TIMER_CHOICES.map((seconds) => (
              <button
                key={seconds}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ lotSeconds: seconds })}
                className={cn(
                  "h-11 flex-1 rounded-xl border text-sm font-bold transition-colors",
                  (config.lotSeconds ?? LOT_TIMER_DURATION) === seconds
                    ? "border-neon bg-neon/15 text-neon"
                    : "border-line bg-surface-2 text-muted hover:text-fg",
                )}
              >
                {seconds}s
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-faint">{t("lobby.timerHint")}</p>
        </div>

        <Stepper
          label={t("common.slots")}
          hint={t("lobby.slotsHint")}
          value={config.slots}
          min={MIN_SLOTS}
          max={MAX_SLOTS}
          disabled={disabled}
          onChange={(slots) => onChange({ slots })}
        />

        <div className="flex flex-col gap-2">
          <Switch
            checked={config.blindDraft}
            onChange={(blindDraft) => !disabled && onChange({ blindDraft })}
            label={t("lobby.blind")}
            hint={t("lobby.blindHint")}
          />
          <Switch
            checked={config.mysteryBox}
            onChange={(mysteryBox) => !disabled && onChange({ mysteryBox })}
            label={t("lobby.mystery")}
            hint={t("lobby.mysteryHint")}
          />
          <Switch
            checked={config.allowDiscards}
            onChange={(allowDiscards) => !disabled && onChange({ allowDiscards })}
            label={t("lobby.discards")}
            hint={t("lobby.discardsHint")}
          />
        </div>

        {/* La posta in palio: facoltativa, finisce in evidenza sulla card finale. */}
        <Input
          label={t("lobby.pledge")}
          hint={t("lobby.pledgeHint")}
          value={config.pledge ?? ""}
          maxLength={60}
          disabled={disabled}
          placeholder={t("lobby.pledgePlaceholder")}
          onChange={(event) => onChange({ pledge: event.target.value })}
        />
      </div>
    </Panel>
  );
}

function Stepper({
  label,
  hint,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-faint">{label}</p>
      <div className="flex items-center gap-2">
        <StepButton
          disabled={disabled || value <= min}
          onClick={() => onChange(value - 1)}
          ariaLabel={`${label} -`}
        >
          <Minus className="size-4" />
        </StepButton>
        <span className="flex h-11 flex-1 items-center justify-center rounded-xl border border-line bg-surface-2 font-mono text-lg font-bold">
          {value}
        </span>
        <StepButton
          disabled={disabled || value >= max}
          onClick={() => onChange(value + 1)}
          ariaLabel={`${label} +`}
        >
          <Plus className="size-4" />
        </StepButton>
      </div>
      {hint ? <p className="mt-1.5 text-xs text-faint">{hint}</p> : null}
    </div>
  );
}

function StepButton({
  children,
  disabled,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-surface-2 text-fg transition-colors hover:border-neon/50 hover:text-neon disabled:opacity-35"
    >
      {children}
    </button>
  );
}
