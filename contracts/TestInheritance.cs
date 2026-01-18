using Neo.SmartContract.Framework;

namespace NeoMiniAppPlatform.Contracts
{
    public class Base : SmartContract
    {
        public static bool True() => true;
    }

    public class Derived : Base
    {
        public static bool Test()
        {
            return True();
        }
    }
}
