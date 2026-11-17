#include <stdio.h>

void reverseDigits(int n);  // Function declaration

int main(void) {
    int num;

    printf("Enter an integer: ");
    scanf("%d", &num);

    printf("Reversed digits: ");
    reverseDigits(num);
    printf("\n");

    return 0;
}

// Function definition
void reverseDigits(int n) {
    if (n < 10) {
        printf("%d", n);
    } else {
        printf("%d", n % 10);
        reverseDigits(n / 10);
    }
}
