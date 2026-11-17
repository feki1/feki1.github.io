#include <stdio.h>
#include "strawberry.h"

// Function to get input
int GetInput(char message[]) {
    int value;
    printf("%s", message);
    scanf("%d", &value);
    return value;
}
