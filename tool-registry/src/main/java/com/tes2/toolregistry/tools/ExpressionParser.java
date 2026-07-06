package com.tes2.toolregistry.tools;

/**
 * Avaliador recursivo-descendente para expressoes aritmeticas:
 * suporta + - * /, parenteses, numeros decimais e sinal unario.
 * Sem dependencias externas (nao usa engine de script).
 */
class ExpressionParser {

    private final String input;
    private int pos = -1;
    private int ch;

    ExpressionParser(String input) {
        this.input = input;
    }

    double parse() {
        nextChar();
        double x = parseExpression();
        if (pos < input.length()) {
            throw new IllegalArgumentException("Caractere inesperado: '" + (char) ch + "'");
        }
        return x;
    }

    private void nextChar() {
        ch = (++pos < input.length()) ? input.charAt(pos) : -1;
    }

    private boolean eat(int charToEat) {
        while (ch == ' ') {
            nextChar();
        }
        if (ch == charToEat) {
            nextChar();
            return true;
        }
        return false;
    }

    // expression = term | expression '+' term | expression '-' term
    private double parseExpression() {
        double x = parseTerm();
        for (; ; ) {
            if (eat('+')) {
                x += parseTerm();
            } else if (eat('-')) {
                x -= parseTerm();
            } else {
                return x;
            }
        }
    }

    // term = factor | term '*' factor | term '/' factor
    private double parseTerm() {
        double x = parseFactor();
        for (; ; ) {
            if (eat('*')) {
                x *= parseFactor();
            } else if (eat('/')) {
                double divisor = parseFactor();
                if (divisor == 0) {
                    throw new IllegalArgumentException("Divisao por zero");
                }
                x /= divisor;
            } else {
                return x;
            }
        }
    }

    // factor = '+' factor | '-' factor | '(' expression ')' | number
    private double parseFactor() {
        if (eat('+')) {
            return parseFactor();
        }
        if (eat('-')) {
            return -parseFactor();
        }

        double x;
        int startPos = pos;
        if (eat('(')) {
            x = parseExpression();
            if (!eat(')')) {
                throw new IllegalArgumentException("Esperado ')'");
            }
        } else if ((ch >= '0' && ch <= '9') || ch == '.') {
            while ((ch >= '0' && ch <= '9') || ch == '.') {
                nextChar();
            }
            x = Double.parseDouble(input.substring(startPos, pos));
        } else {
            throw new IllegalArgumentException("Caractere inesperado: '" + (char) ch + "'");
        }
        return x;
    }
}
