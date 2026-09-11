import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Card from "@/components/Card";
import Screen from "@/components/Screen";
import { SavingsResult, simulateSavings } from "@/lib/simulator";
import { colors } from "@/theme";

function parseNumber(value: string): number {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType="numeric"
        style={styles.fieldInput}
      />
    </View>
  );
}

function Row({
  label,
  value,
  emphasized,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, emphasized && styles.rowValueEmphasized]}>
        {value}
      </Text>
    </View>
  );
}

export default function SimulatorScreen() {
  const [initial, setInitial] = useState("1000");
  const [monthly, setMonthly] = useState("100");
  const [rate, setRate] = useState("5");
  const [months, setMonths] = useState("12");
  const [result, setResult] = useState<SavingsResult | null>(null);

  function calculate() {
    const res = simulateSavings({
      initialAmount: parseNumber(initial),
      monthlyContribution: parseNumber(monthly),
      annualRatePercent: parseNumber(rate),
      months: parseNumber(months),
    });
    setResult(res);
  }

  const currency = (value: number) =>
    value.toLocaleString("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <Screen>
      <Text style={styles.description}>
        Calcula cuánto podrías tener ahorrando de forma constante, con interés
        compuesto mensual. Calculadora 100% local y determinista.
      </Text>

      <Card>
        <Field
          label="Monto inicial ($)"
          value={initial}
          onChange={setInitial}
          placeholder="0.00"
        />
        <Field
          label="Aporte mensual ($)"
          value={monthly}
          onChange={setMonthly}
          placeholder="0.00"
        />
        <Field
          label="Tasa de interés anual (%)"
          value={rate}
          onChange={setRate}
          placeholder="0.00"
        />
        <Field
          label="Número de meses"
          value={months}
          onChange={setMonths}
          placeholder="12"
        />
        <Pressable
          accessibilityRole="button"
          onPress={calculate}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>Calcular</Text>
        </Pressable>
      </Card>

      {result && (
        <Card>
          <Text style={styles.resultTitle}>Resultado estimado</Text>
          <Row label="Aportaciones totales" value={`$ ${currency(result.totalContributions)}`} />
          <Row label="Interés estimado" value={`$ ${currency(result.estimatedInterest)}`} />
          <Row
            label="Saldo final"
            value={`$ ${currency(result.finalBalance)}`}
            emphasized
          />
          <Text style={styles.taxnote}>
            Tasa mensual equivalente: {result.monthlyRatePercent.toLocaleString("es-ES", { maximumFractionDigits: 2 })}%
          </Text>
        </Card>
      )}

      <Text style={styles.disclaimer}>
        Simulación educativa — no constituye asesoría financiera.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginBottom: 16,
  },
  field: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: colors.bg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  button: {
    marginTop: 6,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eef1f6",
  },
  rowLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  rowValue: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  rowValueEmphasized: {
    fontSize: 19,
    fontWeight: "800",
    color: colors.primary,
  },
  taxnote: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 10,
  },
  disclaimer: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 8,
  },
});