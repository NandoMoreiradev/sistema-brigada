// mobile/src/screens/HomeScreen.tsx
// Placeholder pós-login. Prioriza papéis de campo (decisão 12 de
// docs/decisoes.md): aqui entrarão escala/designações, presença e registro
// de ocorrência durante um evento.

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function HomeScreen() {
    const { user, signOut } = useAuth();

    return (
        <View style={styles.container}>
            <Text style={styles.greeting}>Olá, {user?.name}</Text>
            <Text style={styles.subtitle}>
                Em breve: escala, presença e registro de ocorrência.
            </Text>

            <TouchableOpacity style={styles.button} onPress={signOut}>
                <Text style={styles.buttonText}>Sair</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: '#fff',
    },
    greeting: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#6C757D',
        textAlign: 'center',
        marginBottom: 24,
    },
    button: {
        backgroundColor: '#b02a1f',
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 24,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },
});
