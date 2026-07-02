import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AddExpenseScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Add Expense coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center' },
  text: { color: '#fff' },
});
