library ieee;
use ieee.std_logic_1164.all;
entity xorgate is port (A, B: in std_logic; C: out std_logic);
end entity xorgate;

architecture labone of xorgate is begin C <= A xor B;
end architecture labone;
