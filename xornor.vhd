library ieee;
use ieee.std_logic_1164.all;
entity xornor is port (A, B: in std_logic; Z: out std_logic);
end entity xornor;

architecture labfour of xornor is
component norgate is port (A, B: in std_logic; C: out std_logic); end component;
signal J, K, L, M: std_logic;
begin
G1: norgate port map(A => A, B => A, C => J);
G2: norgate port map(A => B, B => B, C => K);
G3: norgate port map(A => J, B => K, C => L);
G4: norgate port map(A => A, B => B, C => M);
G5: norgate port map(A => L, B => M, C => Z);
end architecture labfour;
