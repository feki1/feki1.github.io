library ieee;
use ieee.std_logic_1164.all;
entity andgate is port (A, B: in std_logic; C: out std_logic);
end entity andgate;

architecture labone of andgate is begin C <= A and B;
end architecture labone;
