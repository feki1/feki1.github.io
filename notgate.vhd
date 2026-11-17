library ieee;
use ieee.std_logic_1164.all;
entity notgate is port (A, B: in std_logic; C: out std_logic);
end entity notgate;

architecture labone of notgate is begin C <= not A;
end architecture labone;
